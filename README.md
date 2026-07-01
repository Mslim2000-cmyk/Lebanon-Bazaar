# Lebanon Bazaar — Lebanese Artisan Marketplace

A production-grade, full-stack multi-vendor marketplace platform purpose-built for Lebanese artisans. Sellers apply, get admin-approved, and sell handmade goods; buyers browse and check out as guests or registered users. Built entirely in TypeScript across the stack, with PostgreSQL persistence, JWT-based RBAC, and atomic database transactions for financial correctness.

---

## Table of Contents

- [Live Feature Overview](#live-feature-overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Key Engineering Decisions](#key-engineering-decisions)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Security Model](#security-model)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Scripts](#scripts)

---

## Live Feature Overview

| Role | Capabilities |
|---|---|
| **Guest** | Browse products, categories, sellers; search by keyword; add to cart; check out without registering |
| **Buyer** | All guest capabilities + persistent account; order history |
| **Seller (pending)** | Submitted application; can view dashboard showing pending status |
| **Seller (approved)** | Create/edit/delete products (up to 5 images each); view own orders; view earnings balance |
| **Admin** | Approve/reject/suspend sellers; view all orders; manage categories; audit log of all admin actions |

**Bilingual:** All product names, descriptions, seller business names, and categories support English and Arabic fields (`name`/`name_ar`, `description`/`description_ar`).

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Express 5** + TypeScript | REST API server |
| **PostgreSQL** | Primary database |
| **Drizzle ORM** | Type-safe query builder with SQL migration tracking |
| **Drizzle Kit** | Schema diff + migration generation (`db:generate` / `db:migrate`) |
| **jsonwebtoken** | JWT access tokens (HS256, 7-day expiry) |
| **bcrypt** | Password hashing (cost factor 10) |
| **Zod** | Runtime schema validation for all API inputs |
| **tsx** | TypeScript execution without compile step in dev |

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** + TypeScript | UI framework |
| **Vite 7** | Dev server and production bundler |
| **Wouter v3** | Lightweight client-side router |
| **TanStack Query v5** | Server state, caching, mutations |
| **React Hook Form** + Zod | Forms with schema-driven validation |
| **shadcn/ui** + Radix UI | Accessible component primitives |
| **Tailwind CSS 3** | Utility-first styling |
| **Framer Motion** | Animations |
| **Uppy** | Multi-file uploader (presigned-URL two-step flow) |
| **Lucide React** | Icon set |

### Shared
- **`@shared/schema`** — Drizzle table definitions, inferred TypeScript types, and Zod schemas consumed by both server and client
- **`@shared/models/auth`** — `User`, `SafeUser`, `InsertUser` types; `SafeUser = Omit<User, "passwordHash">` enforces that password hashes never leave the server

---

## Architecture

```
Lebanon-Bazaar/
├── client/          # React SPA (Vite)
├── server/          # Express API
├── shared/          # Shared types & schemas (consumed by both)
├── migrations/      # Drizzle SQL migration files
└── scripts/         # Ops utilities (DB audit, smoke tests)
```

### Request Lifecycle

```
Browser → Vite Dev Proxy → Express 5
                              │
                     ┌────────▼────────┐
                     │  Middleware      │
                     │  authenticateJWT │ ← extracts req.user from Bearer token
                     │  requireRole()   │ ← DB lookup: userHasRole? → 403 if not
                     │  optionalJWT()   │ ← guest routes: attaches user if token present
                     └────────┬────────┘
                              │
                     ┌────────▼────────┐
                     │  Route Handler  │
                     │  asyncHandler() │ ← catches ForbiddenError → 403
                     │  Zod.parse()    │ ← validates body, throws 400 on failure
                     └────────┬────────┘
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
           Service Layer  Storage Layer   DB Transaction
           (seller.ts,    (IStorage       (db.transaction)
            order.ts,      interface,      atomic writes
            auth.ts)       DatabaseStorage)
```

### Frontend Data Flow

```
Component
  └─ useAuth()          ← TanStack Query cache: { user: SafeUser, roles: string[] }
  └─ useSeller()        ← TanStack Query cache: seller profile (GET /api/sellers/me)
  └─ useQuery(...)      ← default queryFn adds Authorization: Bearer <token> header
  └─ useMutation(...)   ← apiRequest() adds auth headers, invalidates cache on success
```

---

## Key Engineering Decisions

### 1. Atomic Transactions for Financial Correctness

Every multi-table write uses `db.transaction()`. None of these operations can partially succeed:

| Operation | Tables written atomically |
|---|---|
| Register user | `users` + `user_roles` (buyer role) |
| Approve seller | `sellers` (status → approved) + `user_roles` (seller role) |
| Create order (COD) | `orders` + `order_items` + `seller_balances.pendingUsd += sellerNet` |
| Deliver order | `orders` (status → delivered) + `seller_balances` (pending → available), guarded by `pendingUsd >= sellerNet` |
| Cancel order | `orders` (status → cancelled) + `seller_balances.pendingUsd -= sellerNet`, same guard |

The balance update for delivery uses a conditional `WHERE pending_usd >= seller_net` — if this matches zero rows, the transaction rolls back and returns `NEGATIVE_BALANCE`, preventing double-delivery or data corruption.

### 2. State Machines for Status Transitions

**Seller status** (`pending → approved/rejected`, `approved → suspended`, `rejected → pending`):
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:   ["approved", "rejected"],
  approved:  ["suspended"],
  rejected:  ["pending"],
  suspended: ["approved"],
};
```

**Order status** (`pending → confirmed/cancelled`, `confirmed → shipped/cancelled`, `shipped → delivered`):
```typescript
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending:   ["confirmed", "cancelled"],
  confirmed: ["shipped",   "cancelled"],
  shipped:   ["delivered"],
  delivered: [],
  cancelled: [],
};
```

Both throw typed errors (`SellerApplicationError`, `OrderError`) with machine-readable `code` fields so callers can distinguish 400 (invalid transition) from 500 (unexpected).

### 3. RBAC — Three-Role System

Roles are stored in a `roles` table and assigned via `user_roles` (composite unique index prevents duplicates). Three roles: `buyer`, `seller`, `admin`.

- Every new registrant automatically gets `buyer` (in the same transaction as user creation)
- `seller` role is assigned only when an admin approves — in the same transaction as the status update
- `admin` role is assigned out-of-band via the `npm run assign-admin` CLI script

Backend enforcement via composable Express middleware:
```typescript
requireAuth           // 401 if no/invalid Bearer token
requireRole("admin")  // DB lookup → 403 if missing
requireApprovedSeller // DB lookup → 403 if seller not found OR status !== "approved"
optionalJWT           // guest-safe: attaches user if token present, never rejects
```

Frontend enforcement via React route guards:
```typescript
// AdminRoute: redirects non-admin to /
// ApprovedSellerRoute: redirects unapproved sellers to /seller/dashboard
<Route path="/admin">
  {() => <AdminRoute><AdminDashboard /></AdminRoute>}
</Route>
<Route path="/seller/products/new">
  {() => <ApprovedSellerRoute><ProductForm /></ApprovedSellerRoute>}
</Route>
```

Backend is the authoritative security boundary — frontend guards are UX, not security.

### 4. Shared TypeScript Types Across the Stack

The `shared/` directory is consumed by both `server/` and `client/` via Vite and TypeScript path aliases (`@shared`). This means:
- Drizzle `$inferSelect` / `$inferInsert` types are defined once and used everywhere
- Zod validation schemas (`createProductSchema`, `createOrderSchema`, `sellerApplicationSchema`) are co-located with the types they validate
- `SafeUser = Omit<User, "passwordHash">` is defined once; the server always strips the hash before sending

### 5. Presigned-URL File Upload Flow

Mimics the AWS S3 presigned-URL pattern — the client requests an upload slot, then PUT-uploads the binary directly, then uses the returned object path as the image URL. The Uppy frontend integration requires zero changes if the backend is swapped for S3 later.

```
Client → POST /api/uploads/request-url   → { uploadURL, objectPath }
Client → PUT  /api/uploads/:fileId        → streams file to disk (UUID-validated)
Client → uses objectPath as image URL
Server → GET  /objects/:fileId            → res.sendFile from uploads/
```

UUID is validated against a strict regex before any file I/O — path traversal is not possible.

### 6. Server-Side Price Calculation

The order creation route never trusts client-submitted prices:
```typescript
const serverPrice = Number(product.priceUsd);  // from DB
const itemTotal = serverPrice * item.quantity;
subtotal += itemTotal;
// commission = subtotal * seller.commissionRate (default 10%)
```

The client's `priceUsd` in the request body is ignored; only `productId` and `quantity` are used.

### 7. Soft Deletes Everywhere

`sellers`, `products`, and `orders` all have a `deleted_at` column. All queries filter `WHERE deleted_at IS NULL`. This preserves referential integrity (foreign keys stay valid) and provides a full audit trail without losing historical order/commission data.

### 8. Admin Audit Log

Every admin action (seller approve/reject/suspend, soft-delete, category create) is recorded in `admin_actions` with a JSONB `metadata` field:
```typescript
await storage.logAdminAction({
  adminUserId: req.user!.id,
  action: "seller_approved",
  targetType: "seller",
  targetId: sellerId,
  metadata: { status: "approved" },
});
```

Accessible via `GET /api/admin/audit-log` (admin only).

---

## Database Schema

```
users
  id (PK, UUID)  email (unique)  password_hash  first_name  last_name
  profile_image_url  is_active  created_at  updated_at

roles                          user_roles
  id (PK)  name (unique)         user_id (FK→users)  role_id (FK→roles)
  description  created_at        UNIQUE(user_id, role_id)

categories
  id (PK)  name  name_ar  slug (unique)  description  icon

sellers
  id (PK)  user_id (FK→users)  business_name  business_name_ar
  bio  phone  location  delivery_areas[]  profile_image  cover_image
  status (ENUM: pending|approved|rejected|suspended)
  commission_rate (default 0.1000)
  applied_at  reviewed_at  reviewed_by (FK→users)  rejection_reason
  created_at  updated_at  deleted_at

seller_balances
  seller_id (PK, FK→sellers CASCADE)
  pending_usd  available_usd  updated_at

products
  id (PK)  seller_id (FK→sellers)  category_id (FK→categories)
  name  name_ar  description  description_ar
  price_usd  images[]  is_available  is_featured
  created_at  updated_at  deleted_at

orders
  id (PK)  order_number (unique)  seller_id (FK→sellers)
  buyer_user_id (nullable, FK→users)  buyer_name  buyer_phone  buyer_email
  delivery_address  delivery_notes
  status (ENUM: pending|confirmed|shipped|delivered|cancelled)
  payment_method (ENUM: cod)
  payment_status (ENUM: pending|collected|failed|refunded)
  subtotal_usd  commission_usd  seller_net_usd  total_usd
  created_at  updated_at  deleted_at

order_items
  id (PK)  order_id (FK→orders)  product_id (FK→products)
  product_name  quantity  price_usd

admin_actions
  id (PK)  admin_user_id  action  target_type  target_id
  metadata (JSONB)  created_at
```

**Indexes:** `sellers.status`, `products.seller_id`, `orders.seller_id`, `orders.buyer_user_id`, `user_roles(user_id, role_id)`, `seller_balances.seller_id`

---

## API Reference

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register; returns `{ user, token, roles }` |
| POST | `/api/auth/login` | — | Login; returns `{ user, token, roles }` |
| GET | `/api/auth/me` | Bearer | Current user + roles |
| POST | `/api/auth/logout` | — | Client-side token drop |

### Catalog (public)
| Method | Path | Description |
|---|---|---|
| GET | `/api/categories` | All categories |
| GET | `/api/categories/:slug` | Single category |
| GET | `/api/sellers` | Approved sellers only |
| GET | `/api/sellers/:id` | Single approved seller |
| GET | `/api/sellers/:id/products` | Available products for a seller |
| GET | `/api/products` | All available products; supports `?category=`, `?featured=true`, `?search=` |
| GET | `/api/products/:id` | Single product with seller + category |

### Seller (approved sellers only)
| Method | Path | Description |
|---|---|---|
| POST | `/api/sellers/apply` | Submit seller application |
| GET | `/api/sellers/me` | Own seller profile |
| GET | `/api/sellers/me/products` | Own products |
| GET | `/api/sellers/me/orders` | Own orders |
| GET | `/api/sellers/me/balance` | Pending + available balance |
| POST | `/api/products` | Create product |
| PATCH | `/api/products/:id` | Update product (ownership enforced) |
| DELETE | `/api/products/:id` | Soft-delete product (ownership enforced) |
| PATCH | `/api/orders/:id/status` | Advance order status (state machine, ownership enforced) |

### Orders
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/orders` | Optional | Place order (guest or authenticated) |

### File Upload
| Method | Path | Description |
|---|---|---|
| POST | `/api/uploads/request-url` | Get presigned upload slot |
| PUT | `/api/uploads/:fileId` | Upload binary (UUID-validated) |
| GET | `/objects/:fileId` | Serve uploaded file |

### Admin (admin role required)
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/sellers` | All sellers (all statuses) |
| PATCH | `/api/admin/sellers/:id/status` | Approve / reject / suspend seller |
| DELETE | `/api/admin/sellers/:id` | Soft-delete seller |
| GET | `/api/admin/orders` | All orders |
| DELETE | `/api/admin/orders/:id` | Soft-delete order |
| GET | `/api/admin/audit-log` | Paginated admin action log |
| POST | `/api/categories` | Create category |

---

## Security Model

### Authentication
- Stateless JWT (HS256); `JWT_SECRET` is required at startup or the process exits
- 7-day token expiry; tokens stored in `localStorage`
- `bcrypt` cost factor 10; a dummy hash is compared on unknown-email logins to prevent timing-based user enumeration

### Authorization
- `requireAuth` — verifies `Authorization: Bearer <token>`, attaches `req.user = { id }`, returns 401 on failure
- `requireRole(roleName)` — live DB query, returns 403 if the user does not hold the role
- `requireApprovedSeller(userId)` — live DB query, returns 403 if the user has no seller record or the seller's status is not `approved`
- `optionalJWT` — same verification but never rejects; used for guest checkout

### Data safety
- `SafeUser = Omit<User, "passwordHash">` — the `passwordHash` field is structurally excluded from every API response at the type level
- Server-side price calculation — order totals are computed from DB prices, not client input
- Seller ownership checks on every product write and order status update
- UUID regex validation on all file upload IDs — prevents path traversal
- Zod validation on all POST/PATCH request bodies — rejects before business logic runs

---

## Project Structure

```
├── client/
│   └── src/
│       ├── components/
│       │   ├── auth/
│       │   │   └── protected-route.tsx   # AdminRoute, ApprovedSellerRoute guards
│       │   ├── layout/
│       │   │   └── header.tsx            # Conditional admin link (isAdmin gated)
│       │   └── ui/                       # shadcn/ui component library
│       ├── hooks/
│       │   ├── use-auth.ts               # JWT + TanStack Query auth state
│       │   ├── use-seller.ts             # Seller profile + approval status
│       │   └── use-upload.ts             # Uppy presigned-URL integration
│       ├── lib/
│       │   └── queryClient.ts            # Default queryFn with auth headers
│       └── pages/
│           ├── admin/index.tsx           # Admin dashboard
│           ├── seller/
│           │   ├── dashboard.tsx         # Seller dashboard
│           │   └── product-form.tsx      # Create/edit product
│           └── ...                       # Public pages
│
├── server/
│   ├── middleware/
│   │   └── auth.ts                       # requireAuth, requireRole, optionalJWT
│   ├── services/
│   │   ├── auth.ts                       # registerUser, loginUser (with transactions)
│   │   ├── seller.ts                     # applyToBecomeSeller, approveSeller, rejectSeller, suspendSeller
│   │   ├── order.ts                      # createOrderTransactional, updateOrderWithStateMachine
│   │   └── file-storage.ts              # Presigned-URL upload routes
│   ├── utils/
│   │   └── guards.ts                     # requireApprovedSeller (throws ForbiddenError)
│   ├── db.ts                             # Drizzle db instance
│   ├── storage.ts                        # IStorage interface + DatabaseStorage implementation
│   ├── routes.ts                         # All Express route registrations
│   ├── seed.ts                           # Category seed + role bootstrap
│   └── index.ts                          # Server entry point
│
├── shared/
│   ├── schema.ts                         # Drizzle tables, relations, Zod schemas, types
│   └── models/
│       └── auth.ts                       # users table, User, SafeUser, InsertUser
│
├── migrations/
│   ├── 0000_unknown_captain_america.sql  # Initial schema
│   └── 0001_nervous_spiral.sql           # Drop legacy sessions table
│
├── scripts/
│   ├── db-audit.ts                       # DB health check (table counts, critical tables, roles)
│   ├── persistence-smoke-test.ts         # 14-step E2E persistence test (raw SQL)
│   └── assign-admin-role.ts             # CLI: assign admin role to an email
│
├── drizzle.config.ts
├── vite.config.ts
└── package.json
```

---

## Local Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ running locally

### 1. Clone and install

```bash
git clone https://github.com/Mslim2000-cmyk/Lebanon-Bazaar.git
cd Lebanon-Bazaar
npm install
```

### 2. Configure environment

Create `.env` in the project root:

```env
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/lebanon_bazaar
JWT_SECRET=your-secure-random-secret-minimum-32-chars
NODE_ENV=development
PORT=5000
```

### 3. Create the database

```bash
psql -U postgres -c "CREATE DATABASE lebanon_bazaar;"
```

### 4. Run migrations

```bash
npm run db:migrate
```

This applies all SQL files in `migrations/` via Drizzle Kit. The dev server also seeds categories and the three base roles (`buyer`, `seller`, `admin`) on first boot.

### 5. Start development server

```bash
npm run dev
```

Opens on `http://localhost:5000`. The Vite dev server proxies `/api` to the Express server.

### 6. Create an admin account

```bash
# Register via the UI first, then:
npm run assign-admin -- --email your@email.com
```

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start Express + Vite dev server with HMR |
| `build` | `npm run build` | Compile client (Vite) + bundle server (esbuild CJS) into `dist/` |
| `start` | `npm run start` | Run production build |
| `check` | `npm run check` | TypeScript type check (zero errors required) |
| `db:generate` | `npm run db:generate` | Diff schema against DB, generate new migration SQL |
| `db:migrate` | `npm run db:migrate` | Apply all pending migrations |
| `db:studio` | `npm run db:studio` | Open Drizzle Studio (visual DB browser) |
| `db:audit` | `npm run db:audit` | Check all critical tables exist, roles seeded, legacy tables removed |
| `test:persistence` | `npm run test:persistence` | 14-step E2E smoke test against real DB (auto-cleans up) |
| `assign-admin` | `npm run assign-admin` | Promote a registered user to admin role |
