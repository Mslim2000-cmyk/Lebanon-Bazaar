import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const CRITICAL_TABLES = [
  "users",
  "roles",
  "user_roles",
  "sellers",
  "products",
  "categories",
  "orders",
  "order_items",
  "seller_balances",
  "admin_actions",
];

const LEGACY_TABLES = ["sessions"];
const REQUIRED_ROLES = ["buyer", "seller", "admin"];

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // All public tables with row counts
    const tablesRes = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesRes.rows.map((r) => r.table_name);

    console.log("\n=== DATABASE AUDIT ===\n");
    console.log("Tables:");

    for (const t of tables) {
      const countRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM "${t}"`
      );
      console.log(`  ${t}: ${countRes.rows[0].count} rows`);
    }

    console.log(`\nTotal tables: ${tables.length}`);

    // Critical tables check
    console.log("\nCritical tables:");
    let allCriticalOk = true;
    for (const ct of CRITICAL_TABLES) {
      const exists = tables.includes(ct);
      console.log(`  ${ct}: ${exists ? "OK" : "MISSING ⚠"}`);
      if (!exists) allCriticalOk = false;
    }
    console.log(allCriticalOk ? "\n✓ All critical tables present" : "\n✗ Missing critical tables!");

    // Legacy/Replit tables
    console.log("\nLegacy/Replit tables:");
    for (const lt of LEGACY_TABLES) {
      const exists = tables.includes(lt);
      console.log(`  ${lt}: ${exists ? "STILL EXISTS ⚠" : "REMOVED ✓"}`);
    }

    // Roles check
    const rolesRes = await client.query<{ name: string }>(
      `SELECT name FROM roles ORDER BY name`
    );
    const existingRoles = rolesRes.rows.map((r) => r.name);
    console.log("\nRoles:");
    for (const role of REQUIRED_ROLES) {
      const exists = existingRoles.includes(role);
      console.log(`  ${role}: ${exists ? "OK" : "MISSING ⚠"}`);
    }

    // Drizzle migrations table
    const hasMigrations = tables.includes("__drizzle_migrations");
    console.log(`\nDrizzle migrations table: ${hasMigrations ? "OK" : "not found (may be in separate schema)"}`);

    console.log("\n=== END AUDIT ===\n");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
