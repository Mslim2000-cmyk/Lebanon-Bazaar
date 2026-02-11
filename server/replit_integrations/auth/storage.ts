import { users, type User, type UpsertUser } from "@shared/models/auth";
import { roles, userRoles } from "@shared/schema";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = userData.id
      ? await this.getUser(userData.id)
      : undefined;

    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!existing) {
      const [userRole] = await db.select().from(roles).where(eq(roles.name, "user"));
      if (userRole) {
        await db.insert(userRoles)
          .values({ userId: user.id, roleId: userRole.id })
          .onConflictDoNothing();
      }
    }

    return user;
  }
}

export const authStorage = new AuthStorage();
