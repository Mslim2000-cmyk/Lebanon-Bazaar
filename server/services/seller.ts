import { storage } from "../storage";
import { type Seller, type SellerApplication } from "@shared/schema";

export class SellerApplicationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "SellerApplicationError";
  }
}

export async function applyToBecomeSeller(
  userId: string,
  application: SellerApplication
): Promise<Seller> {
  const existingSeller = await storage.getSellerByUserId(userId);
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

  if (seller.status !== "pending") {
    throw new SellerApplicationError(
      `Cannot approve seller with status "${seller.status}". Only pending applications can be approved.`,
      "INVALID_STATUS_TRANSITION"
    );
  }

  const updatedSeller = await storage.updateSellerReview(sellerId, {
    status: "approved",
    reviewedAt: new Date(),
    reviewedBy: adminUserId,
  });

  if (!updatedSeller) {
    throw new SellerApplicationError("Failed to update seller", "UPDATE_FAILED");
  }

  return updatedSeller;
}

export async function rejectSeller(
  sellerId: string,
  adminUserId: string,
  reason: string
): Promise<Seller> {
  const seller = await storage.getSellerById(sellerId);
  if (!seller) {
    throw new SellerApplicationError("Seller not found", "NOT_FOUND");
  }

  if (seller.status !== "pending") {
    throw new SellerApplicationError(
      `Cannot reject seller with status "${seller.status}". Only pending applications can be rejected.`,
      "INVALID_STATUS_TRANSITION"
    );
  }

  if (!reason || reason.trim().length === 0) {
    throw new SellerApplicationError(
      "Rejection reason is required",
      "MISSING_REASON"
    );
  }

  const updatedSeller = await storage.updateSellerReview(sellerId, {
    status: "rejected",
    reviewedAt: new Date(),
    reviewedBy: adminUserId,
    rejectionReason: reason.trim(),
  });

  if (!updatedSeller) {
    throw new SellerApplicationError("Failed to update seller", "UPDATE_FAILED");
  }

  return updatedSeller;
}
