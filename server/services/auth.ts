import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { users, roles, userRoles } from "@shared/schema";
import type { SafeUser, User } from "@shared/models/auth";

const BCRYPT_ROUNDS = 12;

const registerSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function generateAccessToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return jwt.sign({ sub: userId }, secret, { expiresIn: "7d" });
}

export function getSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export async function registerUser(
  input: RegisterInput,
): Promise<{ user: SafeUser; token: string; roles: string[] }> {
  const parsed = registerSchema.parse(input);
  const email = parsed.email.toLowerCase().trim();

  const existing = await storage.getUserByEmail(email);
  if (existing) {
    throw new AuthError("Email already registered", "EMAIL_EXISTS", 409);
  }

  const passwordHash = await bcrypt.hash(parsed.password, BCRYPT_ROUNDS);

  // Ensure the buyer role exists (idempotent, safe to run before transaction)
  await storage.ensureRole("buyer", "Standard buyer account");

  // Create user and assign buyer role in a single transaction
  const newUser = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        firstName: parsed.firstName ?? null,
        lastName: parsed.lastName ?? null,
      })
      .returning();

    const [buyerRole] = await tx
      .select()
      .from(roles)
      .where(eq(roles.name, "buyer"));

    if (buyerRole) {
      await tx
        .insert(userRoles)
        .values({ userId: created.id, roleId: buyerRole.id })
        .onConflictDoNothing();
    }

    return created;
  });

  const token = generateAccessToken(newUser.id);
  const roleNames = await storage.getUserRoles(newUser.id);
  return { user: getSafeUser(newUser), token, roles: roleNames };
}

export async function loginUser(
  input: LoginInput,
): Promise<{ user: SafeUser; token: string; roles: string[] }> {
  const parsed = loginSchema.parse(input);
  const email = parsed.email.toLowerCase().trim();

  const user = await storage.getUserByEmail(email);

  // Use constant-time comparison path even when user is not found to avoid timing attacks
  const dummyHash = "$2b$12$invalidhashusedtoensureconstanttimepath.........";
  const hashToCompare = user?.passwordHash ?? dummyHash;

  const passwordValid = await bcrypt.compare(parsed.password, hashToCompare);

  if (!user || !passwordValid || !user.passwordHash) {
    throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS", 401);
  }

  if (!user.isActive) {
    throw new AuthError("Account is deactivated", "ACCOUNT_INACTIVE", 403);
  }

  const token = generateAccessToken(user.id);
  const roles = await storage.getUserRoles(user.id);
  return { user: getSafeUser(user), token, roles };
}
