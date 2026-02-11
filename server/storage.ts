import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  type User, type InsertUser,
  type Category, type InsertCategory,
  type Seller, type InsertSeller,
  type Product, type InsertProduct,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type AdminAction, type InsertAdminAction,
  categories, sellers, products, orders, orderItems,
  users, roles, userRoles, adminActions,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getCategories(): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  getSellers(opts?: { includeDeleted?: boolean }): Promise<Seller[]>;
  getApprovedSellers(): Promise<Seller[]>;
  getSellerById(id: string): Promise<Seller | undefined>;
  getSellerByUserId(userId: string): Promise<Seller | undefined>;
  createSeller(seller: InsertSeller): Promise<Seller>;
  updateSellerStatus(id: string, status: string): Promise<Seller | undefined>;
  updateSellerReview(id: string, reviewData: { 
    status: "approved" | "rejected" | "suspended"; 
    reviewedAt: Date; 
    reviewedBy: string; 
    rejectionReason?: string | null;
  }): Promise<Seller | undefined>;
  softDeleteSeller(id: string): Promise<Seller | undefined>;
  
  getProducts(): Promise<Product[]>;
  getAvailableProducts(): Promise<(Product & { seller: Seller; category: Category })[]>;
  getFeaturedProducts(): Promise<(Product & { seller: Seller; category: Category })[]>;
  getProductById(id: string): Promise<(Product & { seller: Seller; category: Category }) | undefined>;
  getProductsBySeller(sellerId: string): Promise<(Product & { category: Category })[]>;
  getProductsByCategory(categoryId: string): Promise<(Product & { seller: Seller; category: Category })[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  softDeleteProduct(id: string): Promise<Product | undefined>;
  
  getOrders(opts?: { includeDeleted?: boolean }): Promise<Order[]>;
  getOrderById(id: string): Promise<(Order & { items: OrderItem[] }) | undefined>;
  getOrdersBySeller(sellerId: string): Promise<Order[]>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  softDeleteOrder(id: string): Promise<Order | undefined>;

  userHasRole(userId: string, roleName: string): Promise<boolean>;
  getUserRoles(userId: string): Promise<string[]>;
  assignRoleToUser(userId: string, roleName: string): Promise<void>;

  logAdminAction(action: InsertAdminAction): Promise<AdminAction>;
  getAdminActions(opts?: { limit?: number; offset?: number }): Promise<AdminAction[]>;
}

export class DatabaseStorage implements IStorage {
  // ========== USERS ==========
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // ========== CATEGORIES ==========
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategoryById(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  // ========== SELLERS (soft-delete aware) ==========
  async getSellers(opts?: { includeDeleted?: boolean }): Promise<Seller[]> {
    const conditions = opts?.includeDeleted ? [] : [isNull(sellers.deletedAt)];
    if (conditions.length > 0) {
      return await db.select().from(sellers).where(and(...conditions)).orderBy(desc(sellers.createdAt));
    }
    return await db.select().from(sellers).orderBy(desc(sellers.createdAt));
  }

  async getApprovedSellers(): Promise<Seller[]> {
    return await db.select().from(sellers)
      .where(and(eq(sellers.status, "approved"), isNull(sellers.deletedAt)))
      .orderBy(desc(sellers.createdAt));
  }

  async getSellerById(id: string): Promise<Seller | undefined> {
    const [seller] = await db.select().from(sellers)
      .where(and(eq(sellers.id, id), isNull(sellers.deletedAt)));
    return seller;
  }

  async getSellerByUserId(userId: string): Promise<Seller | undefined> {
    const [seller] = await db.select().from(sellers)
      .where(and(eq(sellers.ownerUserId, userId), isNull(sellers.deletedAt)));
    return seller;
  }

  async createSeller(seller: InsertSeller): Promise<Seller> {
    const [newSeller] = await db.insert(sellers).values(seller).returning();
    return newSeller;
  }

  async updateSellerStatus(id: string, status: string): Promise<Seller | undefined> {
    const [updatedSeller] = await db.update(sellers)
      .set({ status: status as any, updatedAt: new Date() })
      .where(and(eq(sellers.id, id), isNull(sellers.deletedAt)))
      .returning();
    return updatedSeller;
  }

  async updateSellerReview(id: string, reviewData: { 
    status: "approved" | "rejected" | "suspended"; 
    reviewedAt: Date; 
    reviewedBy: string; 
    rejectionReason?: string | null;
  }): Promise<Seller | undefined> {
    const [updatedSeller] = await db.update(sellers)
      .set({ 
        status: reviewData.status, 
        reviewedAt: reviewData.reviewedAt,
        reviewedBy: reviewData.reviewedBy,
        rejectionReason: reviewData.rejectionReason || null,
        updatedAt: new Date() 
      })
      .where(and(eq(sellers.id, id), isNull(sellers.deletedAt)))
      .returning();
    return updatedSeller;
  }

  async softDeleteSeller(id: string): Promise<Seller | undefined> {
    const [deleted] = await db.update(sellers)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sellers.id, id), isNull(sellers.deletedAt)))
      .returning();
    return deleted;
  }

  // ========== PRODUCTS (soft-delete aware) ==========
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products)
      .where(isNull(products.deletedAt))
      .orderBy(desc(products.createdAt));
  }

  async getAvailableProducts(): Promise<(Product & { seller: Seller; category: Category })[]> {
    const result = await db.select({
      product: products,
      seller: sellers,
      category: categories,
    })
      .from(products)
      .innerJoin(sellers, eq(products.sellerId, sellers.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(
        eq(products.isAvailable, true),
        eq(sellers.status, "approved"),
        isNull(products.deletedAt),
        isNull(sellers.deletedAt),
      ))
      .orderBy(desc(products.createdAt));
    
    return result.map(r => ({
      ...r.product,
      seller: r.seller,
      category: r.category,
    }));
  }

  async getFeaturedProducts(): Promise<(Product & { seller: Seller; category: Category })[]> {
    const result = await db.select({
      product: products,
      seller: sellers,
      category: categories,
    })
      .from(products)
      .innerJoin(sellers, eq(products.sellerId, sellers.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(
        eq(products.isAvailable, true),
        eq(products.isFeatured, true),
        eq(sellers.status, "approved"),
        isNull(products.deletedAt),
        isNull(sellers.deletedAt),
      ))
      .orderBy(desc(products.createdAt));
    
    return result.map(r => ({
      ...r.product,
      seller: r.seller,
      category: r.category,
    }));
  }

  async getProductById(id: string): Promise<(Product & { seller: Seller; category: Category }) | undefined> {
    const [result] = await db.select({
      product: products,
      seller: sellers,
      category: categories,
    })
      .from(products)
      .innerJoin(sellers, eq(products.sellerId, sellers.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.id, id), isNull(products.deletedAt)));
    
    if (!result) return undefined;
    return {
      ...result.product,
      seller: result.seller,
      category: result.category,
    };
  }

  async getProductsBySeller(sellerId: string): Promise<(Product & { category: Category })[]> {
    const result = await db.select({
      product: products,
      category: categories,
    })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.sellerId, sellerId), isNull(products.deletedAt)))
      .orderBy(desc(products.createdAt));
    
    return result.map(r => ({
      ...r.product,
      category: r.category,
    }));
  }

  async getProductsByCategory(categoryId: string): Promise<(Product & { seller: Seller; category: Category })[]> {
    const result = await db.select({
      product: products,
      seller: sellers,
      category: categories,
    })
      .from(products)
      .innerJoin(sellers, eq(products.sellerId, sellers.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(
        eq(products.categoryId, categoryId),
        eq(products.isAvailable, true),
        eq(sellers.status, "approved"),
        isNull(products.deletedAt),
        isNull(sellers.deletedAt),
      ))
      .orderBy(desc(products.createdAt));
    
    return result.map(r => ({
      ...r.product,
      seller: r.seller,
      category: r.category,
    }));
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updatedProduct] = await db.update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning();
    return updatedProduct;
  }

  async softDeleteProduct(id: string): Promise<Product | undefined> {
    const [deleted] = await db.update(products)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning();
    return deleted;
  }

  // ========== ORDERS (soft-delete aware) ==========
  async getOrders(opts?: { includeDeleted?: boolean }): Promise<Order[]> {
    const conditions = opts?.includeDeleted ? [] : [isNull(orders.deletedAt)];
    if (conditions.length > 0) {
      return await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrderById(id: string): Promise<(Order & { items: OrderItem[] }) | undefined> {
    const [order] = await db.select().from(orders)
      .where(and(eq(orders.id, id), isNull(orders.deletedAt)));
    if (!order) return undefined;
    
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return { ...order, items };
  }

  async getOrdersBySeller(sellerId: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(and(eq(orders.sellerId, sellerId), isNull(orders.deletedAt)))
      .orderBy(desc(orders.createdAt));
  }

  async createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const orderNumber = `SA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    const [newOrder] = await db.insert(orders)
      .values({ ...order, orderNumber })
      .returning();
    
    if (items.length > 0) {
      await db.insert(orderItems).values(
        items.map(item => ({ ...item, orderId: newOrder.id }))
      );
    }
    
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [updatedOrder] = await db.update(orders)
      .set({ status: status as any, updatedAt: new Date() })
      .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
      .returning();
    return updatedOrder;
  }

  async softDeleteOrder(id: string): Promise<Order | undefined> {
    const [deleted] = await db.update(orders)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
      .returning();
    return deleted;
  }

  // ========== RBAC ==========
  async userHasRole(userId: string, roleName: string): Promise<boolean> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.userId, userId), eq(roles.name, roleName)));
    return (result?.count ?? 0) > 0;
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const result = await db.select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    return result.map(r => r.name);
  }

  async assignRoleToUser(userId: string, roleName: string): Promise<void> {
    const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
    if (!role) return;
    await db.insert(userRoles)
      .values({ userId, roleId: role.id })
      .onConflictDoNothing();
  }

  // ========== AUDIT LOGGING ==========
  async logAdminAction(action: InsertAdminAction): Promise<AdminAction> {
    const [logged] = await db.insert(adminActions).values(action).returning();
    return logged;
  }

  async getAdminActions(opts?: { limit?: number; offset?: number }): Promise<AdminAction[]> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    return await db.select().from(adminActions)
      .orderBy(desc(adminActions.createdAt))
      .limit(limit)
      .offset(offset);
  }
}

export const storage = new DatabaseStorage();
