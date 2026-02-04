# Souq Artisan - Lebanese Artisan Marketplace

## Overview
A marketplace connecting Lebanese artisans with local consumers. Features Cash on Delivery (COD) payment, USD pricing, and Lebanon-wide delivery with a 10% commission-based revenue model.

## Project Structure

### Backend (server/)
- `routes.ts` - All API endpoints for sellers, products, orders, categories, and admin
- `storage.ts` - Database operations using Drizzle ORM with PostgreSQL
- `seed.ts` - Seeds initial categories on startup
- `replit_integrations/auth/` - Replit Auth integration
- `replit_integrations/object_storage/` - Object storage for product images

### Frontend (client/src/)
- `pages/` - All React pages (landing, products, sellers, cart, checkout, seller dashboard, admin panel)
- `components/` - Reusable components (ProductCard, SellerCard, CategoryCard, layout)
- `hooks/` - Custom hooks (useAuth, useUpload, use-toast)
- `lib/` - Utilities (queryClient)

### Shared (shared/)
- `schema.ts` - Database schema and types (sellers, products, orders, categories, order_items)
- `models/auth.ts` - Auth-related tables (users, sessions)

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string (provided by Replit)
- `SESSION_SECRET` - Session encryption key

### Admin Configuration
- `ADMIN_USER_IDS` - Comma-separated list of user IDs that have admin access
  - Example: `ADMIN_USER_IDS=user_123,user_456`
  - If not set, admin routes (seller approval, category management, viewing all orders) will be inaccessible

## Key Features

### For Buyers
- Browse products and artisans
- Guest checkout (no account required)
- Cash on Delivery payment
- Cart with multi-seller support (creates separate orders per seller)

### For Sellers
- Apply to become a seller (requires admin approval)
- Product management (add, edit, upload images)
- Order management (view, confirm, mark shipped/delivered)
- Dashboard with sales stats

### For Admins
- Approve/reject seller applications
- View all orders and commissions
- Manage categories

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

## User Preferences
- Lebanese-inspired warm color palette (terracotta, sand tones)
- Plus Jakarta Sans (body) + Playfair Display (headings) fonts
- Dark mode support
