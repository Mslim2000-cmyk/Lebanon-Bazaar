# Souq Artisan - Lebanese Artisan Marketplace

## Overview
A marketplace connecting Lebanese artisans with local consumers. Features Cash on Delivery (COD) payment, USD pricing, and Lebanon-wide delivery with per-seller commission rates (default 10%).

## Project Structure

### Backend (server/)
- `routes.ts` - All API endpoints for sellers, products, orders, categories, and admin
- `storage.ts` - Database operations using Drizzle ORM with PostgreSQL (includes RBAC, soft-delete, audit logging)
- `seed.ts` - Seeds initial categories on startup
- `services/seller.ts` - Seller state machine (pending→approved/rejected, approved→suspended, suspended→approved, rejected→pending re-apply)
- `services/order.ts` - Order state machine + transactional order creation with atomic balance updates
- `utils/guards.ts` - Auth guards (requireApprovedSeller, ForbiddenError)
- `replit_integrations/auth/` - Replit Auth integration (auto-assigns 'user' role on signup)
- `replit_integrations/object_storage/` - Object storage for product images

### Scripts
- `scripts/assign-admin-role.ts` - CLI utility to assign admin role: `npx tsx scripts/assign-admin-role.ts <user_id>`

### Frontend (client/src/)
- `pages/` - All React pages (landing, products, sellers, cart, checkout, seller dashboard, admin panel)
- `components/` - Reusable components (ProductCard, SellerCard, CategoryCard, layout)
- `hooks/` - Custom hooks (useAuth, useUpload, use-toast)
- `lib/` - Utilities (queryClient)

### Shared (shared/)
- `schema.ts` - Database schema and types (sellers, products, orders, categories, order_items, roles, user_roles, admin_actions)
- `models/auth.ts` - Auth-related tables (users, sessions)

## Architecture Decisions

### RBAC (Role-Based Access Control)
- Roles stored as text in `roles` table (extensible, no TypeScript enums)
- `user_roles` junction table links users to roles
- `userHasRole(userId, roleName)` queries DB directly — single source of truth
- Admin check in `requireAdmin` middleware uses DB-based role lookup (replaced env-based ADMIN_USER_IDS)
- New users auto-assigned 'user' role on first login via auth upsert flow
- Assign admin: `npx tsx scripts/assign-admin-role.ts <user_id>`

### Soft Delete
- `deletedAt` timestamp column on sellers, products, orders (nullable, default null)
- All storage queries filter `WHERE deletedAt IS NULL` by default
- Soft-deleted records are invisible to the application but preserved in DB
- Admin routes: `DELETE /api/admin/sellers/:id`, `DELETE /api/admin/orders/:id`
- Sellers can soft-delete their own products: `DELETE /api/products/:id`

### Admin Audit Trail
- `admin_actions` table logs all admin operations
- Fields: adminUserId, action, targetType, targetId, metadata (jsonb), createdAt
- Actions logged: seller_approved, seller_rejected, seller_suspended, soft_delete_seller, soft_delete_order, create_category
- Viewable at `GET /api/admin/audit-log?limit=50&offset=0`

### Per-Seller Commission
- `commissionRate` decimal column on sellers (default 0.1000 = 10%)
- Order creation reads seller's commission rate instead of hardcoded 0.1
- Commission computed server-side: `subtotal * seller.commissionRate`

### Seller State Machine
- Valid transitions: pending→approved, pending→rejected, approved→suspended, suspended→approved, rejected→pending (re-apply)
- Enforced in `server/services/seller.ts` via `VALID_TRANSITIONS` map
- Re-apply: rejected sellers can submit new application, transitions back to pending

### Order State Machine & Accounting
- Valid transitions: pending→confirmed/cancelled, confirmed→shipped/cancelled, shipped→delivered; delivered/cancelled are terminal
- Enforced in `server/services/order.ts` via `ALLOWED_TRANSITIONS` map
- Same-status guard: throws SAME_STATUS error if order.status === newStatus
- `seller_net_usd` snapshot stored at order creation (subtotal - commission), sole value for all balance movements
- `seller_balances` table: pending_usd (funds in transit), available_usd (funds cleared)
- Balance auto-created on seller creation via `createSeller` in storage.ts
- Transactional order creation: `createOrderTransactional` atomically inserts order + items + increments seller pending balance
- On delivered + COD: paymentStatus→collected, atomic move pending→available (using seller_net_usd)
- On cancelled + COD (paymentStatus=pending): paymentStatus→failed, atomic reverse pending
- Negative balance guard: WHERE pending_usd >= amount prevents negative balances
- All balance mutations use row-level SQL arithmetic (no read-then-write races)
- `GET /api/sellers/me/balance` returns authenticated seller's balance

### Pagination
- Admin routes return `{ data, total, page, limit }` format
- `GET /api/admin/sellers?page=1&limit=20`
- `GET /api/admin/orders?page=1&limit=20`

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string (provided by Replit)
- `SESSION_SECRET` - Session encryption key

### Deprecated
- `ADMIN_USER_IDS` - No longer used (replaced by DB-based admin role)

## Key Features

### For Buyers
- Browse products and artisans
- Guest checkout (no account required)
- Cash on Delivery payment
- Cart with multi-seller support (creates separate orders per seller)

### For Sellers
- Apply to become a seller (requires admin approval, rejected sellers can re-apply)
- Product management (add, edit, soft-delete, upload images)
- Order management (view, confirm, mark shipped/delivered)
- Dashboard with sales stats

### For Admins
- Approve/reject/suspend seller applications
- View all orders and commissions (paginated)
- Manage categories
- Soft-delete sellers and orders
- View audit log of all admin actions

## Tech Stack
- Frontend: React, TypeScript, TanStack Query, Wouter, Tailwind CSS, Shadcn UI
- Backend: Express, TypeScript, Drizzle ORM
- Database: PostgreSQL (Neon)
- Auth: Replit Auth
- Storage: Replit Object Storage

## Development
Run `npm run dev` to start the development server on port 5000.

## Database
- Run `npm run db:push` to sync schema changes to the database
- Categories are auto-seeded on server startup if none exist
- Roles ('user', 'admin') are seeded in DB

## User Preferences
- Lebanese-inspired warm color palette (terracotta, sand tones)
- Plus Jakarta Sans (body) + Playfair Display (headings) fonts
- Dark mode support
- Monolithic architecture, avoid overengineering
- No TypeScript enums for roles (use DB strings for extensibility)
- Non-blocking try/catch around email calls
