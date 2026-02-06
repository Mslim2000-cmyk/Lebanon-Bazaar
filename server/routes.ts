import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertCategorySchema, 
  insertOrderSchema,
  insertOrderItemSchema,
  sellerApplicationSchema,
  createProductSchema,
  updateProductSchema,
} from "@shared/schema";
import { z } from "zod";
import { 
  applyToBecomeSeller, 
  approveSeller, 
  rejectSeller, 
  SellerApplicationError 
} from "./services/seller";
import { requireApprovedSeller, ForbiddenError } from "./utils/guards";

// Helper to get user from session (from Replit Auth)
function getUser(req: Request) {
  const raw = (req as any).user;
  if (!raw) return null;
  return { id: raw.claims?.sub as string, ...raw };
}

// Middleware to require authentication
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Admin user IDs (for MVP, configured via env var; in production use proper roles)
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);

// Log warning if no admin users configured
if (ADMIN_USER_IDS.length === 0) {
  console.warn("⚠️  Warning: ADMIN_USER_IDS not configured. Admin routes will be inaccessible. Set ADMIN_USER_IDS env var with comma-separated user IDs.");
}

// Middleware to require admin authorization
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!ADMIN_USER_IDS.includes(user.id)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Async handler wrapper
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (err instanceof ForbiddenError) {
        return res.status(403).json({ error: "Access denied" });
      }
      next(err);
    });
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ========== CATEGORIES ==========
  
  // Get all categories
  app.get("/api/categories", asyncHandler(async (req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  }));

  // Get category by slug
  app.get("/api/categories/:slug", asyncHandler(async (req, res) => {
    const category = await storage.getCategoryBySlug(req.params.slug);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  }));

  // Create category (admin only)
  app.post("/api/categories", requireAdmin, asyncHandler(async (req, res) => {
    const data = insertCategorySchema.parse(req.body);
    const category = await storage.createCategory(data);
    res.status(201).json(category);
  }));

  // ========== SELLERS ==========
  
  // Get all approved sellers (public)
  app.get("/api/sellers", asyncHandler(async (req, res) => {
    const sellers = await storage.getApprovedSellers();
    res.json(sellers);
  }));

  // Get current user's seller profile
  app.get("/api/sellers/me", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req);
    const seller = await storage.getSellerByUserId(user.id);
    if (!seller) {
      return res.status(404).json({ error: "Seller profile not found" });
    }
    res.json(seller);
  }));

  // Get current seller's products
  app.get("/api/sellers/me/products", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req);
    const seller = await requireApprovedSeller(user.id);
    const products = await storage.getProductsBySeller(seller.id);
    res.json(products);
  }));

  // Get current seller's orders
  app.get("/api/sellers/me/orders", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req);
    const seller = await requireApprovedSeller(user.id);
    const orders = await storage.getOrdersBySeller(seller.id);
    res.json(orders);
  }));

  // Get seller by ID (public)
  app.get("/api/sellers/:id", asyncHandler(async (req, res) => {
    const seller = await storage.getSellerById(req.params.id);
    if (!seller || seller.status !== "approved") {
      return res.status(404).json({ error: "Seller not found" });
    }
    res.json(seller);
  }));

  // Get seller's products by seller ID (public)
  app.get("/api/sellers/:id/products", asyncHandler(async (req, res) => {
    const seller = await storage.getSellerById(req.params.id);
    if (!seller || seller.status !== "approved") {
      return res.status(404).json({ error: "Seller not found" });
    }
    const products = await storage.getProductsBySeller(req.params.id);
    res.json(products.filter(p => p.isAvailable));
  }));

  // Submit seller application
  app.post("/api/sellers/apply", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req);
    
    try {
      const application = sellerApplicationSchema.parse(req.body);
      const seller = await applyToBecomeSeller(user.id, application);
      res.status(201).json(seller);
    } catch (error) {
      if (error instanceof SellerApplicationError) {
        return res.status(400).json({ error: error.message, code: error.code });
      }
      throw error;
    }
  }));

  // ========== PRODUCTS ==========
  
  // Get all available products (public)
  app.get("/api/products", asyncHandler(async (req, res) => {
    const { category, featured, search } = req.query;
    
    let products;
    if (featured === "true") {
      products = await storage.getFeaturedProducts();
    } else if (category && typeof category === "string") {
      products = await storage.getProductsByCategory(category);
    } else {
      products = await storage.getAvailableProducts();
    }
    
    // Simple search filter
    if (search && typeof search === "string") {
      const searchLower = search.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }
    
    res.json(products);
  }));

  // Get product by ID (public)
  app.get("/api/products/:id", asyncHandler(async (req, res) => {
    const product = await storage.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  }));

  // Create product (seller only)
  app.post("/api/products", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req);
    const seller = await requireApprovedSeller(user.id);
    
    const validated = createProductSchema.parse(req.body);
    
    const category = await storage.getCategoryById(validated.categoryId);
    if (!category) {
      return res.status(400).json({ error: "Invalid category" });
    }
    
    const product = await storage.createProduct({
      ...validated,
      sellerId: seller.id,
      isFeatured: false,
    });
    res.status(201).json(product);
  }));

  // Update product (seller only)
  app.patch("/api/products/:id", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req);
    const seller = await requireApprovedSeller(user.id);
    
    const existingProduct = await storage.getProductById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (existingProduct.sellerId !== seller.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const validated = updateProductSchema.parse(req.body);
    
    if (validated.categoryId) {
      const category = await storage.getCategoryById(validated.categoryId);
      if (!category) {
        return res.status(400).json({ error: "Invalid category" });
      }
    }
    
    const product = await storage.updateProduct(req.params.id, validated);
    res.json(product);
  }));

  // ========== ORDERS ==========
  
  // Create order (guest checkout allowed)
  app.post("/api/orders", asyncHandler(async (req, res) => {
    const orderSchema = z.object({
      sellerId: z.string(),
      buyerName: z.string().min(2),
      buyerPhone: z.string().min(8),
      buyerEmail: z.string().email().nullable().optional(),
      deliveryAddress: z.string().min(10),
      deliveryNotes: z.string().nullable().optional(),
      items: z.array(z.object({
        productId: z.string(),
        productName: z.string(),
        quantity: z.number().int().positive(),
        priceUsd: z.string(),
      })).min(1),
    });
    
    const data = orderSchema.parse(req.body);
    
    // Verify seller exists and is approved
    const seller = await storage.getSellerById(data.sellerId);
    if (!seller || seller.status !== "approved") {
      return res.status(400).json({ error: "Invalid seller" });
    }
    
    // Validate products and compute prices server-side
    const validatedItems = [];
    let subtotal = 0;
    
    for (const item of data.items) {
      const product = await storage.getProductById(item.productId);
      
      // Verify product exists, is available, and belongs to the seller
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }
      if (!product.isAvailable) {
        return res.status(400).json({ error: `Product "${product.name}" is not available` });
      }
      if (product.sellerId !== data.sellerId) {
        return res.status(400).json({ error: `Product "${product.name}" does not belong to this seller` });
      }
      
      // Use server-side price (ignore client-supplied price)
      const serverPrice = Number(product.priceUsd);
      const itemTotal = serverPrice * item.quantity;
      subtotal += itemTotal;
      
      validatedItems.push({
        orderId: "",
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        priceUsd: serverPrice.toFixed(2),
      });
    }
    
    // Calculate commission and total server-side (10% commission)
    const commission = subtotal * 0.1;
    const total = subtotal;
    
    const orderData = {
      sellerId: data.sellerId,
      buyerName: data.buyerName,
      buyerPhone: data.buyerPhone,
      buyerEmail: data.buyerEmail || null,
      deliveryAddress: data.deliveryAddress,
      deliveryNotes: data.deliveryNotes || null,
      subtotalUsd: subtotal.toFixed(2),
      commissionUsd: commission.toFixed(2),
      totalUsd: total.toFixed(2),
      status: "pending" as const,
      paymentMethod: "cod" as const,
      paymentStatus: "pending" as const,
    };
    
    const order = await storage.createOrder(orderData, validatedItems);
    res.status(201).json(order);
  }));

  // Update order status (seller only)
  app.patch("/api/orders/:id/status", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req);
    const seller = await requireApprovedSeller(user.id);
    
    const order = await storage.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.sellerId !== seller.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const { status } = req.body;
    const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    const updatedOrder = await storage.updateOrderStatus(req.params.id, status);
    res.json(updatedOrder);
  }));

  // ========== ADMIN ROUTES ==========
  
  // Get all sellers (admin only)
  app.get("/api/admin/sellers", requireAdmin, asyncHandler(async (req, res) => {
    const sellers = await storage.getSellers();
    res.json(sellers);
  }));

  // Update seller status (admin only)
  app.patch("/api/admin/sellers/:id/status", requireAdmin, asyncHandler(async (req, res) => {
    const user = getUser(req);
    const { status, rejectionReason } = req.body;
    
    try {
      let seller;
      if (status === "approved") {
        seller = await approveSeller(req.params.id, user.id);
      } else if (status === "rejected") {
        seller = await rejectSeller(req.params.id, user.id, rejectionReason || "");
      } else {
        return res.status(400).json({ error: "Invalid status. Use 'approved' or 'rejected'." });
      }
      res.json(seller);
    } catch (error) {
      if (error instanceof SellerApplicationError) {
        if (error.code === "NOT_FOUND") {
          return res.status(404).json({ error: error.message, code: error.code });
        }
        return res.status(400).json({ error: error.message, code: error.code });
      }
      throw error;
    }
  }));

  // Get all orders (admin only)
  app.get("/api/admin/orders", requireAdmin, asyncHandler(async (req, res) => {
    const orders = await storage.getOrders();
    res.json(orders);
  }));

  return httpServer;
}
