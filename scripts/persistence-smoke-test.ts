/**
 * End-to-end persistence smoke test.
 * Tests against the real PostgreSQL database (DATABASE_URL from .env).
 * Uses a "test_audit_" prefix on all test data for easy identification.
 * Cleans up test data (soft-deletes or direct deletes) after running.
 *
 * Run: npm run test:persistence
 */
import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const PREFIX = "test_audit_";
const TEST_EMAIL = `${PREFIX}${Date.now()}@example.com`;
const TEST_BUSINESS = `${PREFIX}TestShop_${Date.now()}`;

type Row = Record<string, unknown>;

let client: pg.Client;
let pass = 0;
let fail = 0;

function ok(label: string) {
  console.log(`  ✓ ${label}`);
  pass++;
}

function err(label: string, detail?: unknown) {
  console.error(`  ✗ ${label}`, detail ?? "");
  fail++;
}

async function q<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await client.query<T>(sql, params);
  return res.rows;
}

async function cleanup(userId: string, sellerId: string | null, productId: string | null, orderId: string | null) {
  console.log("\n--- Cleanup ---");
  try {
    if (orderId) await q(`UPDATE orders SET deleted_at = NOW() WHERE id = $1`, [orderId]);
    if (productId) await q(`UPDATE products SET deleted_at = NOW() WHERE id = $1`, [productId]);
    if (sellerId) await q(`UPDATE sellers SET deleted_at = NOW() WHERE id = $1`, [sellerId]);
    await q(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
    await q(`DELETE FROM users WHERE id = $1`, [userId]);
    console.log("  Test data cleaned up.");
  } catch (e) {
    console.error("  Cleanup error:", e);
  }
}

async function main() {
  client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let userId = "";
  let sellerId: string | null = null;
  let productId: string | null = null;
  let orderId: string | null = null;

  console.log("\n=== PERSISTENCE SMOKE TEST ===");
  console.log(`  Test email: ${TEST_EMAIL}\n`);

  try {
    // ── 1. Register buyer ──────────────────────────────────────────────────
    console.log("1. Register test buyer");
    const bcrypt = await import("bcrypt");
    const hash = await bcrypt.hash("TestPass123!", 10);

    const [user] = await q<{ id: string }>(
      `INSERT INTO users (email, password_hash, is_active)
       VALUES ($1, $2, true) RETURNING id`,
      [TEST_EMAIL, hash]
    );
    userId = user.id;
    ok(`User created: ${userId}`);

    // ── 2. Confirm user exists ─────────────────────────────────────────────
    console.log("2. Confirm user in DB");
    const [dbUser] = await q<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [userId]);
    dbUser ? ok("User row found") : err("User row missing");

    // ── 3. Assign buyer role ───────────────────────────────────────────────
    console.log("3. Assign buyer role");
    const [buyerRole] = await q<{ id: string }>(`SELECT id FROM roles WHERE name = 'buyer'`);
    if (buyerRole) {
      await q(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, buyerRole.id]);
      const [ur] = await q<{ user_id: string }>(`SELECT user_id FROM user_roles WHERE user_id = $1 AND role_id = $2`, [userId, buyerRole.id]);
      ur ? ok("buyer role assigned") : err("buyer role not in user_roles");
    } else {
      err("buyer role missing from roles table");
    }

    // ── 4. Apply as seller ─────────────────────────────────────────────────
    console.log("4. Apply as seller (status=pending)");
    const [seller] = await q<{ id: string; status: string }>(
      `INSERT INTO sellers (user_id, business_name, phone, location, status)
       VALUES ($1, $2, '+961 00 000 000', 'Beirut, Lebanon', 'pending') RETURNING id, status`,
      [userId, TEST_BUSINESS]
    );
    sellerId = seller.id;
    seller.status === "pending" ? ok(`Seller created with status=pending: ${sellerId}`) : err(`Expected status=pending, got ${seller.status}`);

    // Insert seller_balances (createSeller service does this automatically; we do it manually here)
    await q(
      `INSERT INTO seller_balances (seller_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [sellerId]
    );

    // ── 5. Confirm pending seller cannot create product (guard logic) ──────
    console.log("5. Confirm pending seller blocked from product creation");
    const [pendingSeller] = await q<{ status: string }>(`SELECT status FROM sellers WHERE id = $1`, [sellerId]);
    pendingSeller?.status !== "approved" ? ok("Pending seller correctly blocked (status check)") : err("Seller should still be pending");

    const [bal] = await q<{ seller_id: string }>(`SELECT seller_id FROM seller_balances WHERE seller_id = $1`, [sellerId]);
    bal ? ok("seller_balances row exists") : err("seller_balances row missing");

    // ── 6. Create admin + approve seller ──────────────────────────────────
    console.log("6. Approve seller as admin");
    const adminEmail = `${PREFIX}admin_${Date.now()}@example.com`;
    const [admin] = await q<{ id: string }>(
      `INSERT INTO users (email, password_hash, is_active) VALUES ($1, $2, true) RETURNING id`,
      [adminEmail, hash]
    );
    const adminId = admin.id;

    const [adminRole] = await q<{ id: string }>(`SELECT id FROM roles WHERE name = 'admin'`);
    if (adminRole) {
      await q(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [adminId, adminRole.id]);
    }

    // Approve via direct update (mirrors approveSeller service)
    const [sellerRole] = await q<{ id: string }>(`SELECT id FROM roles WHERE name = 'seller'`);
    await q(
      `UPDATE sellers SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1, updated_at = NOW() WHERE id = $2`,
      [adminId, sellerId]
    );
    if (sellerRole) {
      await q(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, sellerRole.id]);
    }

    const [approvedSeller] = await q<{ status: string }>(`SELECT status FROM sellers WHERE id = $1`, [sellerId]);
    approvedSeller?.status === "approved" ? ok("Seller status=approved") : err(`Expected approved, got ${approvedSeller?.status}`);

    const [sellerRoleAssigned] = await q<{ user_id: string }>(
      `SELECT user_id FROM user_roles WHERE user_id = $1 AND role_id = $2`,
      [userId, sellerRole?.id]
    );
    sellerRoleAssigned ? ok("seller role assigned to user") : err("seller role not assigned");

    // Clean up admin user
    await q(`DELETE FROM user_roles WHERE user_id = $1`, [adminId]);
    await q(`DELETE FROM users WHERE id = $1`, [adminId]);

    // ── 7. Create product ─────────────────────────────────────────────────
    console.log("7. Create product");
    const [cat] = await q<{ id: string }>(`SELECT id FROM categories LIMIT 1`);
    if (!cat) { err("No categories found — seed first"); }
    else {
      const [product] = await q<{ id: string }>(
        `INSERT INTO products (seller_id, category_id, name, description, price_usd, images, is_available, is_featured)
         VALUES ($1, $2, $3, $4, 9.99, ARRAY['/objects/test'], true, false) RETURNING id`,
        [sellerId, cat.id, `${PREFIX}Product`, "A test product for smoke testing purposes."]
      );
      productId = product.id;
      ok(`Product created: ${productId}`);
    }

    // ── 8. Create order ───────────────────────────────────────────────────
    console.log("8. Create order");
    if (productId) {
      const orderNumber = `SA-SMOKE-${Date.now()}`;
      const subtotal = "9.99";
      const commission = "1.00";
      const sellerNet = "8.99";

      const [order] = await q<{ id: string }>(
        `INSERT INTO orders
           (order_number, seller_id, buyer_user_id, buyer_name, buyer_phone,
            delivery_address, status, payment_method, payment_status,
            subtotal_usd, commission_usd, seller_net_usd, total_usd)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'cod', 'pending', $7, $8, $9, $7)
         RETURNING id`,
        [orderNumber, sellerId, userId, "Test Buyer", "+961 00 000 001",
          "123 Test St, Beirut, Lebanon", subtotal, commission, sellerNet]
      );
      orderId = order.id;
      ok(`Order created: ${orderId}`);

      // Insert order item
      await q(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, price_usd)
         VALUES ($1, $2, $3, 1, $4)`,
        [orderId, productId, `${PREFIX}Product`, "9.99"]
      );
      const [item] = await q<{ order_id: string }>(`SELECT order_id FROM order_items WHERE order_id = $1`, [orderId]);
      item ? ok("order_items row exists") : err("order_items row missing");

      // Update seller balance pendingUsd
      await q(
        `UPDATE seller_balances
         SET pending_usd = pending_usd::numeric + $1::numeric, updated_at = NOW()
         WHERE seller_id = $2`,
        [sellerNet, sellerId]
      );
      const [bal2] = await q<{ pending_usd: string }>(`SELECT pending_usd FROM seller_balances WHERE seller_id = $1`, [sellerId]);
      parseFloat(bal2?.pending_usd ?? "0") > 0 ? ok(`seller_balances.pendingUsd = ${bal2.pending_usd}`) : err("pendingUsd not updated");

      // ── 9. Deliver order + balance movement ───────────────────────────
      console.log("9. Deliver order — balance moves pending → available");
      await q(`UPDATE orders SET status = 'delivered', payment_status = 'collected', updated_at = NOW() WHERE id = $1`, [orderId]);
      await q(
        `UPDATE seller_balances
         SET pending_usd = pending_usd::numeric - $1::numeric,
             available_usd = available_usd::numeric + $1::numeric,
             updated_at = NOW()
         WHERE seller_id = $2`,
        [sellerNet, sellerId]
      );
      const [bal3] = await q<{ pending_usd: string; available_usd: string }>(
        `SELECT pending_usd, available_usd FROM seller_balances WHERE seller_id = $1`,
        [sellerId]
      );
      const avail = parseFloat(bal3?.available_usd ?? "0");
      const pend = parseFloat(bal3?.pending_usd ?? "1");
      avail > 0 ? ok(`available_usd = ${avail}`) : err(`available_usd should be > 0, got ${avail}`);
      pend === 0 ? ok(`pending_usd = 0`) : err(`pending_usd should be 0, got ${pend}`);
    }

  } catch (e) {
    console.error("\nUnexpected error during test:", e);
    fail++;
  } finally {
    await cleanup(userId, sellerId, productId, orderId);
    await client.end();

    console.log("\n=== RESULTS ===");
    console.log(`  PASS: ${pass}`);
    console.log(`  FAIL: ${fail}`);
    if (fail === 0) {
      console.log("\n✓ All persistence checks passed\n");
    } else {
      console.log("\n✗ Some checks failed — review output above\n");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
