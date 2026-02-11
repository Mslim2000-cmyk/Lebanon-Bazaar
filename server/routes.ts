import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertCategorySchema, 
  sellerApplicationSchema,
  createProductSchema,
  updateProductSchema,
  createOrderSchema,
} from "@shared/schema";
import { z } from "zod";
import { 
  applyToBecomeSeller, 
  approveSeller, 
  rejectSeller,
  suspendSeller,
  SellerApplicationError 
} from "./services/seller";
import { requireApprovedSeller, ForbiddenError } from "./utils/guards";

function getUser(req: Request) {
  const raw = (req as any).user;
  if (!raw) return null;
  return { id: raw.claims?.sub as string, ...raw };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  storage.userHasRole(user.id, "admin").then((isAdmin) => {
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  }).catch(next);
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (err instanceof ForbiddenError) {
        return res.status(403).json({ error: err.message });
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
  
  app.get("/api/categories", asyncHandler(async (req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  }));

  app.get("/api/categories/:slug", asyncHandler(async (req, res) => {
    const category = await storage.getCategoryBySlug(req.params.slug);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  }));

  app.post("/api/categories", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
    const data = insertCategorySchema.parse(req.body);
    const category = await storage.createCategory(data);
    await storage.logAdminAction({
      adminUserId: user.id,
      action: "create_category",
      targetType: "category",
      targetId: category.id,
      metadata: { name: category.name },
    });
    res.status(201).json(category);
  }));

  // ========== SELLERS ==========
  
  app.get("/api/sellers", asyncHandler(async (req, res) => {
    const approvedSellers = await storage.getApprovedSellers();
    res.json(approvedSellers);
  }));

  app.get("/api/sellers/me", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
    const seller = await storage.getSellerByUserId(user.id);
    if (!seller) {
      return res.status(404).json({ error: "Seller profile not found" });
    }
    res.json(seller);
  }));

  app.get("/api/sellers/me/products", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
    const seller = await requireApprovedSeller(user.id);
    const sellerProducts = await storage.getProductsBySeller(seller.id);
    res.json(sellerProducts);
  }));

  app.get("/api/sellers/me/orders", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
    const seller = await requireApprovedSeller(user.id);
    const sellerOrders = await storage.getOrdersBySeller(seller.id);
    res.json(sellerOrders);
  }));

  app.get("/api/sellers/:id", asyncHandler(async (req, res) => {
    const seller = await storage.getSellerById(req.params.id);
    if (!seller || seller.status !== "approved") {
      return res.status(404).json({ error: "Seller not found" });
    }
    res.json(seller);
  }));

  app.get("/api/sellers/:id/products", asyncHandler(async (req, res) => {
    const seller = await storage.getSellerById(req.params.id);
    if (!seller || seller.status !== "approved") {
      return res.status(404).json({ error: "Seller not found" });
    }
    const sellerProducts = await storage.getProductsBySeller(req.params.id);
    res.json(sellerProducts.filter(p => p.isAvailable));
  }));

  app.post("/api/sellers/apply", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
    
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
  
  app.get("/api/products", asyncHandler(async (req, res) => {
    const { category, featured, search } = req.query;
    
    let productList;
    if (featured === "true") {
      productList = await storage.getFeaturedProducts();
    } else if (category && typeof category === "string") {
      productList = await storage.getProductsByCategory(category);
    } else {
      productList = await storage.getAvailableProducts();
    }
    
    if (search && typeof search === "string") {
      const searchLower = search.toLowerCase();
      productList = productList.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }
    
    res.json(productList);
  }));

  app.get("/api/products/:id", asyncHandler(async (req, res) => {
    const product = await storage.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  }));

  app.post("/api/products", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
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

  app.patch("/api/products/:id", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
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
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  }));

  app.delete("/api/products/:id", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
    const seller = await requireApprovedSeller(user.id);
    
    const existingProduct = await storage.getProductById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (existingProduct.sellerId !== seller.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const deleted = await storage.softDeleteProduct(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product deleted" });
  }));

  // ========== ORDERS ==========
  
  app.post("/api/orders", asyncHandler(async (req, res) => {
    const data = createOrderSchema.parse(req.body);
    
    const seller = await storage.getSellerById(data.sellerId);
    if (!seller || seller.status !== "approved") {
      return res.status(400).json({ error: "Invalid seller" });
    }
    
    const validatedItems = [];
    let subtotal = 0;
    
    for (const item of data.items) {
      const product = await storage.getProductById(item.productId);
      
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }
      if (!product.isAvailable) {
        return res.status(400).json({ error: `Product "${product.name}" is not available` });
      }
      if (product.sellerId !== data.sellerId) {
        return res.status(400).json({ error: `Product "${product.name}" does not belong to this seller` });
      }
      
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
    
    const commissionRate = Number(seller.commissionRate);
    const commission = subtotal * commissionRate;
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

  app.patch("/api/orders/:id/status", requireAuth, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
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
  
  app.get("/api/admin/sellers", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const allSellers = await storage.getSellers();
    const total = allSellers.length;
    const paginated = allSellers.slice((page - 1) * limit, page * limit);
    res.json({ data: paginated, total, page, limit });
  }));

  app.patch("/api/admin/sellers/:id/status", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
    
    const adminSellerStatusSchema = z.object({
      status: z.enum(["approved", "rejected", "suspended"]),
      rejectionReason: z.string().optional(),
    });
    const { status, rejectionReason } = adminSellerStatusSchema.parse(req.body);
    
    try {
      let seller;
      if (status === "approved") {
        seller = await approveSeller(req.params.id, user.id);
      } else if (status === "rejected") {
        seller = await rejectSeller(req.params.id, user.id, rejectionReason || "");
      } else if (status === "suspended") {
        seller = await suspendSeller(req.params.id, user.id, rejectionReason);
      } else {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      await storage.logAdminAction({
        adminUserId: user.id,
        action: `seller_${status}`,
        targetType: "seller",
        targetId: req.params.id,
        metadata: { status, rejectionReason: rejectionReason || null },
      });
      
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

  app.get("/api/admin/orders", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const allOrders = await storage.getOrders();
    const total = allOrders.length;
    const paginated = allOrders.slice((page - 1) * limit, page * limit);
    res.json({ data: paginated, total, page, limit });
  }));

  app.get("/api/admin/audit-log", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const actions = await storage.getAdminActions({ limit, offset });
    res.json(actions);
  }));

  app.delete("/api/admin/sellers/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
    const deleted = await storage.softDeleteSeller(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Seller not found" });
    }
    await storage.logAdminAction({
      adminUserId: user.id,
      action: "soft_delete_seller",
      targetType: "seller",
      targetId: req.params.id,
      metadata: { businessName: deleted.businessName },
    });
    res.json({ message: "Seller deleted" });
  }));

  app.delete("/api/admin/orders/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
    const user = getUser(req)!;
    const deleted = await storage.softDeleteOrder(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Order not found" });
    }
    await storage.logAdminAction({
      adminUserId: user.id,
      action: "soft_delete_order",
      targetType: "order",
      targetId: req.params.id,
      metadata: { orderNumber: deleted.orderNumber },
    });
    res.json({ message: "Order deleted" });
  }));

  return httpServer;
}
