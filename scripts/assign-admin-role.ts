import { db } from "../server/db";
import { roles, userRoles, users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: npx tsx scripts/assign-admin-role.ts <user_id>");
    process.exit(1);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    console.error(`User ${userId} not found`);
    process.exit(1);
  }

  const [adminRole] = await db.select().from(roles).where(eq(roles.name, "admin"));
  if (!adminRole) {
    console.error("Admin role not found. Seed roles first.");
    process.exit(1);
  }

  await db.insert(userRoles)
    .values({ userId, roleId: adminRole.id })
    .onConflictDoNothing();

  console.log(`Admin role assigned to user ${userId} (${user.email || user.firstName || "unknown"})`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
