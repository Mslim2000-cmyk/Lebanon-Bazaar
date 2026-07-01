import { db } from "../server/db";
import { roles, userRoles, users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: npm run assign-admin <user_id>");
    process.exit(1);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    console.error(`User ${userId} not found`);
    process.exit(1);
  }

  // Ensure admin role exists
  await db.insert(roles)
    .values({ name: "admin", description: "Platform administrator" })
    .onConflictDoNothing();

  const [adminRole] = await db.select().from(roles).where(eq(roles.name, "admin"));
  if (!adminRole) {
    console.error("Failed to create or find admin role");
    process.exit(1);
  }

  await db.insert(userRoles)
    .values({ userId, roleId: adminRole.id })
    .onConflictDoNothing();

  const displayName = user.email ?? user.firstName ?? userId;
  console.log(`Admin role assigned to user ${userId} (${displayName})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
