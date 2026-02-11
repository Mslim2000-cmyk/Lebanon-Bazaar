import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, pgEnum, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

// Enums
export const sellerStatusEnum = pgEnum("seller_status", ["pending", "approved", "rejected", "suspended"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "confirmed", "shipped", "delivered", "cancelled"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cod"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "confirmed", "failed"]);

// ========== RBAC TABLES ==========

export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  userId: varchar("user_id").notNull(),
  roleId: varchar("role_id").notNull().references(() => roles.id),
}, (table) => [
  uniqueIndex("user_roles_user_role_idx").on(table.userId, table.roleId),
  index("user_roles_user_id_idx").on(table.userId),
  index("user_roles_role_id_idx").on(table.roleId),
]);

// ========== ADMIN AUDIT TABLE ==========

export const adminActions = pgTable("admin_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ========== BUSINESS TABLES ==========

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
});

export const sellers = pgTable("sellers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("user_id").notNull(),
  businessName: text("business_name").notNull(),
  businessNameAr: text("business_name_ar"),
  bio: text("bio"),
  phone: text("phone").notNull(),
  location: text("location").notNull(),
  deliveryAreas: text("delivery_areas").array(),
  profileImage: text("profile_image"),
  coverImage: text("cover_image"),
  status: sellerStatusEnum("status").default("pending").notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).default("0.1000").notNull(),
  appliedAt: timestamp("applied_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("sellers_status_idx").on(table.status),
]);

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => sellers.id),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  priceUsd: decimal("price_usd", { precision: 10, scale: 2 }).notNull(),
  images: text("images").array().notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("products_seller_id_idx").on(table.sellerId),
]);

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  sellerId: varchar("seller_id").notNull().references(() => sellers.id),
  buyerName: text("buyer_name").notNull(),
  buyerPhone: text("buyer_phone").notNull(),
  buyerEmail: text("buyer_email"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryNotes: text("delivery_notes"),
  status: orderStatusEnum("status").default("pending").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").default("cod").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default("pending").notNull(),
  subtotalUsd: decimal("subtotal_usd", { precision: 10, scale: 2 }).notNull(),
  commissionUsd: decimal("commission_usd", { precision: 10, scale: 2 }).notNull(),
  totalUsd: decimal("total_usd", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("orders_seller_id_idx").on(table.sellerId),
]);

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  priceUsd: decimal("price_usd", { precision: 10, scale: 2 }).notNull(),
});

// ========== RELATIONS ==========

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

export const sellersRelations = relations(sellers, ({ many }) => ({
  products: many(products),
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ one }) => ({
  seller: one(sellers, {
    fields: [products.sellerId],
    references: [sellers.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  seller: one(sellers, {
    fields: [orders.sellerId],
    references: [sellers.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

// ========== ZOD SCHEMAS ==========

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });

export const insertSellerSchema = createInsertSchema(sellers).omit({ 
  id: true, 
  commissionRate: true,
  appliedAt: true, 
  reviewedAt: true, 
  reviewedBy: true, 
  rejectionReason: true,
  createdAt: true, 
  updatedAt: true,
  deletedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });

export const createProductSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  nameAr: z.string().nullable().optional(),
  description: z.string().min(20, "Description must be at least 20 characters"),
  descriptionAr: z.string().nullable().optional(),
  priceUsd: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Price must be a positive number"),
  categoryId: z.string().min(1, "Category is required"),
  images: z.array(z.string()).min(1, "At least one image is required").max(5, "Maximum 5 images allowed"),
  isAvailable: z.boolean().optional().default(true),
});

export const updateProductSchema = z.object({
  name: z.string().min(2, "Product name is required").optional(),
  nameAr: z.string().nullable().optional(),
  description: z.string().min(20, "Description must be at least 20 characters").optional(),
  descriptionAr: z.string().nullable().optional(),
  priceUsd: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Price must be a positive number").optional(),
  categoryId: z.string().min(1, "Category is required").optional(),
  images: z.array(z.string()).min(1, "At least one image is required").max(5, "Maximum 5 images allowed").optional(),
  isAvailable: z.boolean().optional(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, orderNumber: true, createdAt: true, updatedAt: true, deletedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });

export const createOrderSchema = z.object({
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

export const sellerApplicationSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  businessNameAr: z.string().nullable().optional(),
  phone: z.string().min(8, "Valid phone number required"),
  location: z.string().min(2, "Location is required"),
  bio: z.string().nullable().optional(),
});

export type SellerApplication = z.infer<typeof sellerApplicationSchema>;

// ========== TYPES ==========

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Seller = typeof sellers.$inferSelect;
export type InsertSeller = z.infer<typeof insertSellerSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type CreateProduct = z.infer<typeof createProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;

export type AdminAction = typeof adminActions.$inferSelect;
export type InsertAdminAction = typeof adminActions.$inferInsert;

export type ProductWithSeller = Product & { seller: Seller; category: Category };
export type OrderWithItems = Order & { items: OrderItem[]; seller: Seller };
