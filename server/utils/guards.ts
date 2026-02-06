import { storage } from "../storage";
import type { Seller } from "@shared/schema";

export class ForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireApprovedSeller(userId: string): Promise<Seller> {
  const seller = await storage.getSellerByUserId(userId);

  if (!seller) {
    throw new ForbiddenError("Seller access required");
  }

  if (seller.status !== "approved") {
    throw new ForbiddenError("Seller access required");
  }

  return seller;
}
