import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import {
  type User, type InsertUser,
  type Category, type InsertCategory,
  type Seller, type InsertSeller,
  type Product, type InsertProduct,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  categories, sellers, products, orders, orderItems,
  users
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Sellers
  getSellers(): Promise<Seller[]>;
  getApprovedSellers(): Promise<Seller[]>;
  getSellerById(id: string): Promise<Seller | undefined>;
  getSellerByUserId(userId: string): Promise<Seller | undefined>;
  createSeller(seller: InsertSeller): Promise<Seller>;
  updateSellerStatus(id: string, status: string): Promise<Seller | undefined>;
  updateSellerReview(id: string, reviewData: { 
    status: "approved" | "rejected"; 
    reviewedAt: Date; 
    reviewedBy: string; 
    rejectionReason?: string | null;
  }): Promise<Seller | undefined>;
  
  // Products
  getProducts(): Promise<Product[]>;
  getAvailableProducts(): Promise<(Product & { seller: Seller; category: Category })[]>;
  getFeaturedProducts(): Promise<(Product & { seller: Seller; category: Category })[]>;
  getProductById(id: string): Promise<(Product & { seller: Seller; category: Category }) | undefined>;
  getProductsBySeller(sellerId: string): Promise<(Product & { category: Category })[]>;
  getProductsByCategory(categoryId: string): Promise<(Product & { seller: Seller; category: Category })[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  
  // Orders
  getOrders(): Promise<Order[]>;
  getOrderById(id: string): Promise<(Order & { items: OrderItem[] }) | undefined>;
  getOrdersBySeller(sellerId: string): Promise<Order[]>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Categories
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

  // Sellers
  async getSellers(): Promise<Seller[]> {
    return await db.select().from(sellers).orderBy(desc(sellers.createdAt));
  }

  async getApprovedSellers(): Promise<Seller[]> {
    return await db.select().from(sellers)
      .where(eq(sellers.status, "approved"))
      .orderBy(desc(sellers.createdAt));
  }

  async getSellerById(id: string): Promise<Seller | undefined> {
    const [seller] = await db.select().from(sellers).where(eq(sellers.id, id));
    return seller;
  }

  async getSellerByUserId(userId: string): Promise<Seller | undefined> {
    const [seller] = await db.select().from(sellers).where(eq(sellers.ownerUserId, userId));
    return seller;
  }

  async createSeller(seller: InsertSeller): Promise<Seller> {
    const [newSeller] = await db.insert(sellers).values(seller).returning();
    return newSeller;
  }

  async updateSellerStatus(id: string, status: string): Promise<Seller | undefined> {
    const [updatedSeller] = await db.update(sellers)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(sellers.id, id))
      .returning();
    return updatedSeller;
  }

  async updateSellerReview(id: string, reviewData: { 
    status: "approved" | "rejected"; 
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
      .where(eq(sellers.id, id))
      .returning();
    return updatedSeller;
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
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
        eq(sellers.status, "approved")
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
        eq(sellers.status, "approved")
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
      .where(eq(products.id, id));
    
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
      .where(eq(products.sellerId, sellerId))
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
        eq(sellers.status, "approved")
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
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrderById(id: string): Promise<(Order & { items: OrderItem[] }) | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;
    
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return { ...order, items };
  }

  async getOrdersBySeller(sellerId: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.sellerId, sellerId))
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
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }
}

export const storage = new DatabaseStorage();
