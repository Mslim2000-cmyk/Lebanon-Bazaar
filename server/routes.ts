import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
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
  SellerApplicationError,
} from "./services/seller";
import { createOrderTransactional, updateOrderWithStateMachine, OrderError } from "./services/order";
import { requireApprovedSeller, ForbiddenError } from "./utils/guards";
import { requireAuth, requireRole, optionalJWT } from "./middleware/auth";
import { registerUser, loginUser, getSafeUser, AuthError } from "./services/auth";

// Express 5 types `req.params` as `string | string[]`; at runtime params are always strings.
function p(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

function q(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
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

  // ========== AUTH ROUTES ==========

  app.post("/api/auth/register", asyncHandler(async (req, res) => {
    try {
      const { user, token, roles } = await registerUser(req.body);
      res.status(201).json({ user, token, roles });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.errors[0]?.message ?? "Validation error" });
      }
      throw err;
    }
  }));

  app.post("/api/auth/login", asyncHandler(async (req, res) => {
    try {
      const { user, token, roles } = await loginUser(req.body);
      res.json({ user, token, roles });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.errors[0]?.message ?? "Validation error" });
      }
      throw err;
    }
  }));

  app.get("/api/auth/me", requireAuth, asyncHandler(async (req, res) => {
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const roles = await storage.getUserRoles(req.user!.id);
    res.json({ user: getSafeUser(user), roles });
  }));

  app.post("/api/auth/logout", (_req, res) => {
    res.json({ success: true });
  });

  // ========== CATEGORIES ==========

  app.get("/api/categories", asyncHandler(async (_req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  }));

  app.get("/api/categories/:slug", asyncHandler(async (req, res) => {
    const category = await storage.getCategoryBySlug(p(req.params.slug));
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  }));

  app.post("/api/categories", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
    const data = insertCategorySchema.parse(req.body);
    const category = await storage.createCategory(data);
    await storage.logAdminAction({
      adminUserId: req.user!.id,
      action: "create_category",
      targetType: "category",
      targetId: category.id,
      metadata: { name: category.name },
    });
    res.status(201).json(category);
  }));

  // ========== SELLERS ==========

  app.get("/api/sellers", asyncHandler(async (_req, res) => {
    const approvedSellers = await storage.getApprovedSellers();
    res.json(approvedSellers);
  }));

  app.get("/api/sellers/me", requireAuth, asyncHandler(async (req, res) => {
    const seller = await storage.getSellerByUserId(req.user!.id);
    if (!seller) {
      return res.status(404).json({ error: "Seller profile not found" });
    }
    res.json(seller);
  }));

  app.get("/api/sellers/me/products", requireAuth, asyncHandler(async (req, res) => {
    const seller = await requireApprovedSeller(req.user!.id);
    const sellerProducts = await storage.getProductsBySeller(seller.id);
    res.json(sellerProducts);
  }));

  app.get("/api/sellers/me/orders", requireAuth, asyncHandler(async (req, res) => {
    const seller = await requireApprovedSeller(req.user!.id);
    const sellerOrders = await storage.getOrdersBySeller(seller.id);
    res.json(sellerOrders);
  }));

  app.get("/api/sellers/me/balance", requireAuth, asyncHandler(async (req, res) => {
    const seller = await requireApprovedSeller(req.user!.id);
    const balance = await storage.getSellerBalance(seller.id);
    if (!balance) {
      return res.status(404).json({ error: "Balance not found" });
    }
    res.json(balance);
  }));

  app.get("/api/sellers/:id", asyncHandler(async (req, res) => {
    const seller = await storage.getSellerById(p(req.params.id));
    if (!seller || seller.status !== "approved") {
      return res.status(404).json({ error: "Seller not found" });
    }
    res.json(seller);
  }));

  app.get("/api/sellers/:id/products", asyncHandler(async (req, res) => {
    const id = p(req.params.id);
    const seller = await storage.getSellerById(id);
    if (!seller || seller.status !== "approved") {
      return res.status(404).json({ error: "Seller not found" });
    }
    const sellerProducts = await storage.getProductsBySeller(id);
    res.json(sellerProducts.filter(prod => prod.isAvailable));
  }));

  app.post("/api/sellers/apply", requireAuth, asyncHandler(async (req, res) => {
    try {
      const application = sellerApplicationSchema.parse(req.body);
      const seller = await applyToBecomeSeller(req.user!.id, application);
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
    const category = q(req.query.category as string | string[] | undefined);
    const featured = q(req.query.featured as string | string[] | undefined);
    const search = q(req.query.search as string | string[] | undefined);

    let productList;
    if (featured === "true") {
      productList = await storage.getFeaturedProducts();
    } else if (category) {
      productList = await storage.getProductsByCategory(category);
    } else {
      productList = await storage.getAvailableProducts();
    }

    if (search) {
      const searchLower = search.toLowerCase();
      productList = productList.filter(prod =>
        prod.name.toLowerCase().includes(searchLower) ||
        prod.description.toLowerCase().includes(searchLower)
      );
    }

    res.json(productList);
  }));

  app.get("/api/products/:id", asyncHandler(async (req, res) => {
    const product = await storage.getProductById(p(req.params.id));
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  }));

  app.post("/api/products", requireAuth, asyncHandler(async (req, res) => {
    const seller = await requireApprovedSeller(req.user!.id);

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
    const productId = p(req.params.id);
    const seller = await requireApprovedSeller(req.user!.id);

    const existingProduct = await storage.getProductById(productId);
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

    const product = await storage.updateProduct(productId, validated);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  }));

  app.delete("/api/products/:id", requireAuth, asyncHandler(async (req, res) => {
    const productId = p(req.params.id);
    const seller = await requireApprovedSeller(req.user!.id);

    const existingProduct = await storage.getProductById(productId);
    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (existingProduct.sellerId !== seller.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const deleted = await storage.softDeleteProduct(productId);
    if (!deleted) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product deleted" });
  }));

  // ========== ORDERS ==========

  // Guest checkout allowed: optionalJWT attaches req.user if token present, but does not reject
  app.post("/api/orders", optionalJWT, asyncHandler(async (req, res) => {
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
    const sellerNet = subtotal - commission;
    const total = subtotal;

    const orderData = {
      sellerId: data.sellerId,
      buyerUserId: req.user?.id ?? null,
      buyerName: data.buyerName,
      buyerPhone: data.buyerPhone,
      buyerEmail: data.buyerEmail || null,
      deliveryAddress: data.deliveryAddress,
      deliveryNotes: data.deliveryNotes || null,
      subtotalUsd: subtotal.toFixed(2),
      commissionUsd: commission.toFixed(2),
      sellerNetUsd: sellerNet.toFixed(2),
      totalUsd: total.toFixed(2),
      status: "pending" as const,
      paymentMethod: "cod" as const,
      paymentStatus: "pending" as const,
    };

    const order = await createOrderTransactional(orderData, validatedItems);
    res.status(201).json(order);
  }));

  app.patch("/api/orders/:id/status", requireAuth, asyncHandler(async (req, res) => {
    const orderId = p(req.params.id);
    const seller = await requireApprovedSeller(req.user!.id);

    const existingOrder = await storage.getOrderById(orderId);
    if (!existingOrder) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (existingOrder.sellerId !== seller.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { status } = req.body;
    try {
      const updatedOrder = await updateOrderWithStateMachine(orderId, status);
      res.json(updatedOrder);
    } catch (err) {
      if (err instanceof OrderError) {
        const statusCode = err.code === "SAME_STATUS" || err.code === "INVALID_STATUS_TRANSITION" ? 400 : 500;
        return res.status(statusCode).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  }));

  // ========== ADMIN ROUTES ==========

  app.get("/api/admin/sellers", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
    const allSellers = await storage.getSellers();
    res.json(allSellers);
  }));

  app.patch("/api/admin/sellers/:id/status", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
    const sellerId = p(req.params.id);
    const adminSellerStatusSchema = z.object({
      status: z.enum(["approved", "rejected", "suspended"]),
      rejectionReason: z.string().optional(),
    });
    const { status, rejectionReason } = adminSellerStatusSchema.parse(req.body);

    try {
      let seller;
      if (status === "approved") {
        seller = await approveSeller(sellerId, req.user!.id);
      } else if (status === "rejected") {
        seller = await rejectSeller(sellerId, req.user!.id, rejectionReason || "");
      } else if (status === "suspended") {
        seller = await suspendSeller(sellerId, req.user!.id, rejectionReason);
      } else {
        return res.status(400).json({ error: "Invalid status" });
      }

      await storage.logAdminAction({
        adminUserId: req.user!.id,
        action: `seller_${status}`,
        targetType: "seller",
        targetId: sellerId,
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

  app.get("/api/admin/orders", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
    const allOrders = await storage.getOrders();
    res.json(allOrders);
  }));

  app.get("/api/admin/audit-log", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(q(req.query.limit as string | undefined) || "50") || 50));
    const offset = Math.max(0, parseInt(q(req.query.offset as string | undefined) || "0") || 0);
    const actions = await storage.getAdminActions({ limit, offset });
    res.json(actions);
  }));

  app.delete("/api/admin/sellers/:id", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
    const sellerId = p(req.params.id);
    const deleted = await storage.softDeleteSeller(sellerId);
    if (!deleted) {
      return res.status(404).json({ error: "Seller not found" });
    }
    await storage.logAdminAction({
      adminUserId: req.user!.id,
      action: "soft_delete_seller",
      targetType: "seller",
      targetId: sellerId,
      metadata: { businessName: deleted.businessName },
    });
    res.json({ message: "Seller deleted" });
  }));

  app.delete("/api/admin/orders/:id", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
    const orderId = p(req.params.id);
    const deleted = await storage.softDeleteOrder(orderId);
    if (!deleted) {
      return res.status(404).json({ error: "Order not found" });
    }
    await storage.logAdminAction({
      adminUserId: req.user!.id,
      action: "soft_delete_order",
      targetType: "order",
      targetId: orderId,
      metadata: { orderNumber: deleted.orderNumber },
    });
    res.json({ message: "Order deleted" });
  }));

  return httpServer;
}
