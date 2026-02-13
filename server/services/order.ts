import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  orders, orderItems, sellerBalances, sellers,
  type Order, type InsertOrderItem,
} from "@shared/schema";

export class OrderError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "OrderError";
  }
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

interface CreateOrderInput {
  sellerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string | null;
  deliveryAddress: string;
  deliveryNotes: string | null;
  subtotalUsd: string;
  commissionUsd: string;
  sellerNetUsd: string;
  totalUsd: string;
  status: "pending";
  paymentMethod: "cod";
  paymentStatus: "pending";
}

export async function createOrderTransactional(
  orderData: CreateOrderInput,
  items: InsertOrderItem[]
): Promise<Order> {
  const orderNumber = `SA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const sellerNet = parseFloat(orderData.sellerNetUsd);

  return await db.transaction(async (tx) => {
    const [newOrder] = await tx.insert(orders)
      .values({ ...orderData, orderNumber })
      .returning();

    if (items.length > 0) {
      await tx.insert(orderItems).values(
        items.map(item => ({ ...item, orderId: newOrder.id }))
      );
    }

    if (orderData.paymentMethod === "cod") {
      const result = await tx.update(sellerBalances)
        .set({
          pendingUsd: sql`${sellerBalances.pendingUsd}::numeric + ${sellerNet.toFixed(2)}::numeric`,
          updatedAt: new Date(),
        })
        .where(eq(sellerBalances.sellerId, orderData.sellerId))
        .returning();

      if (result.length === 0) {
        throw new OrderError(
          "Seller balance record not found",
          "BALANCE_NOT_FOUND"
        );
      }
    }

    return newOrder;
  });
}

export async function updateOrderWithStateMachine(
  orderId: string,
  newStatus: string
): Promise<Order> {
  const [order] = await db.select().from(orders)
    .where(and(eq(orders.id, orderId), isNull(orders.deletedAt)));

  if (!order) {
    throw new OrderError("Order not found", "NOT_FOUND");
  }

  if (order.status === newStatus) {
    throw new OrderError(
      `Order is already "${newStatus}"`,
      "SAME_STATUS"
    );
  }

  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new OrderError(
      `Cannot transition from "${order.status}" to "${newStatus}"`,
      "INVALID_STATUS_TRANSITION"
    );
  }

  const sellerNet = parseFloat(order.sellerNetUsd);

  return await db.transaction(async (tx) => {
    const updateData: Record<string, any> = {
      status: newStatus as any,
      updatedAt: new Date(),
    };

    if (newStatus === "delivered" && order.paymentMethod === "cod") {
      updateData.paymentStatus = "collected";

      const result = await tx.update(sellerBalances)
        .set({
          pendingUsd: sql`${sellerBalances.pendingUsd}::numeric - ${sellerNet.toFixed(2)}::numeric`,
          availableUsd: sql`${sellerBalances.availableUsd}::numeric + ${sellerNet.toFixed(2)}::numeric`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sellerBalances.sellerId, order.sellerId),
            sql`${sellerBalances.pendingUsd}::numeric >= ${sellerNet.toFixed(2)}::numeric`
          )
        )
        .returning();

      if (result.length === 0) {
        throw new OrderError(
          "Insufficient pending balance — possible double-delivery or data inconsistency",
          "NEGATIVE_BALANCE"
        );
      }
    }

    if (newStatus === "cancelled" && order.paymentMethod === "cod" && order.paymentStatus === "pending") {
      updateData.paymentStatus = "failed";

      const result = await tx.update(sellerBalances)
        .set({
          pendingUsd: sql`${sellerBalances.pendingUsd}::numeric - ${sellerNet.toFixed(2)}::numeric`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sellerBalances.sellerId, order.sellerId),
            sql`${sellerBalances.pendingUsd}::numeric >= ${sellerNet.toFixed(2)}::numeric`
          )
        )
        .returning();

      if (result.length === 0) {
        throw new OrderError(
          "Insufficient pending balance — possible data inconsistency",
          "NEGATIVE_BALANCE"
        );
      }
    }

    const [updatedOrder] = await tx.update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning();

    return updatedOrder;
  });
}
