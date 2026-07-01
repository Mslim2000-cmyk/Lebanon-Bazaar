import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { sellers, roles, userRoles } from "@shared/schema";
import { type Seller, type SellerApplication } from "@shared/schema";

export class SellerApplicationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "SellerApplicationError";
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  rejected: ["pending"],
  suspended: ["approved"],
};

function assertTransition(currentStatus: string, targetStatus: string) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    throw new SellerApplicationError(
      `Cannot transition from "${currentStatus}" to "${targetStatus}".`,
      "INVALID_STATUS_TRANSITION"
    );
  }
}

export async function applyToBecomeSeller(
  userId: string,
  application: SellerApplication
): Promise<Seller> {
  const existingSeller = await storage.getSellerByUserId(userId);

  if (existingSeller && existingSeller.status === "rejected") {
    assertTransition("rejected", "pending");
    const updated = await storage.updateSellerStatus(existingSeller.id, "pending");
    if (!updated) {
      throw new SellerApplicationError("Failed to re-apply", "UPDATE_FAILED");
    }
    return updated;
  }

  if (existingSeller) {
    throw new SellerApplicationError(
      "You already have a seller application",
      "ALREADY_APPLIED"
    );
  }

  const seller = await storage.createSeller({
    ownerUserId: userId,
    businessName: application.businessName,
    businessNameAr: application.businessNameAr || null,
    phone: application.phone,
    location: application.location,
    bio: application.bio || null,
    status: "pending",
  });

  return seller;
}

export async function approveSeller(
  sellerId: string,
  adminUserId: string
): Promise<Seller> {
  const seller = await storage.getSellerById(sellerId);
  if (!seller) {
    throw new SellerApplicationError("Seller not found", "NOT_FOUND");
  }

  assertTransition(seller.status, "approved");

  // Update seller status and assign seller role in one transaction
  const updatedSeller = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(sellers)
      .set({
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(and(eq(sellers.id, sellerId), isNull(sellers.deletedAt)))
      .returning();

    if (!updated) {
      throw new SellerApplicationError("Failed to update seller", "UPDATE_FAILED");
    }

    const [sellerRole] = await tx
      .select()
      .from(roles)
      .where(eq(roles.name, "seller"));

    if (sellerRole) {
      await tx
        .insert(userRoles)
        .values({ userId: updated.ownerUserId, roleId: sellerRole.id })
        .onConflictDoNothing();
    }

    return updated;
  });

  return updatedSeller;
}

export async function rejectSeller(
  sellerId: string,
  adminUserId: string,
  reason?: string
): Promise<Seller> {
  const seller = await storage.getSellerById(sellerId);
  if (!seller) {
    throw new SellerApplicationError("Seller not found", "NOT_FOUND");
  }

  assertTransition(seller.status, "rejected");

  const updatedSeller = await storage.updateSellerReview(sellerId, {
    status: "rejected",
    reviewedAt: new Date(),
    reviewedBy: adminUserId,
    rejectionReason: reason?.trim() || null,
  });

  if (!updatedSeller) {
    throw new SellerApplicationError("Failed to update seller", "UPDATE_FAILED");
  }

  return updatedSeller;
}

export async function suspendSeller(
  sellerId: string,
  adminUserId: string,
  reason?: string
): Promise<Seller> {
  const seller = await storage.getSellerById(sellerId);
  if (!seller) {
    throw new SellerApplicationError("Seller not found", "NOT_FOUND");
  }

  assertTransition(seller.status, "suspended");

  const updatedSeller = await storage.updateSellerReview(sellerId, {
    status: "suspended",
    reviewedAt: new Date(),
    reviewedBy: adminUserId,
    rejectionReason: reason?.trim() || null,
  });

  if (!updatedSeller) {
    throw new SellerApplicationError("Failed to update seller", "UPDATE_FAILED");
  }

  return updatedSeller;
}
