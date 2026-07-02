# Deploying Lebanon Bazaar to Vercel

## Architecture on Vercel

```
Vercel
├── api/index.ts          → Serverless function (all /api/* and /objects/* routes)
├── dist/public/          → Static SPA (React + Vite build output)
└── vercel.json           → Routing: /api/* → function, /* → index.html
```

---

## Prerequisites

- Node.js 20+
- A PostgreSQL database reachable from Vercel (Neon, Supabase, or Railway)
- A Vercel Blob store for file uploads

---

## Step 1 — Create a production PostgreSQL database

Choose one:

**Neon (recommended — free tier, Vercel marketplace integration)**
1. Go to vercel.com/dashboard → Storage → Create new → Neon
2. Or create at neon.tech and copy the connection string
3. Connection string format: `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`

**Supabase**
1. Create project at supabase.com
2. Settings → Database → Connection string (URI mode)

**Railway**
1. New project → Postgres → Connect → copy the DATABASE_URL

---

## Step 2 — Create a Vercel Blob store

1. Vercel dashboard → Storage → Create new → Blob
2. Copy the `BLOB_READ_WRITE_TOKEN` from the store settings

---

## Step 3 — Push repo to GitHub

```bash
git add .
git commit -m "Add Vercel deployment config"
git push origin main
```

---

## Step 4 — Import project on Vercel

1. vercel.com/new → Import Git Repository → select your GitHub repo
2. Framework Preset: **Other**
3. Build Command: `npm run build:vercel` (already in vercel.json — overrides automatically)
4. Output Directory: `dist/public` (already in vercel.json)
5. Click **Deploy** (it will fail on the first run — that's expected; env vars are not set yet)

---

## Step 5 — Add environment variables in Vercel

Settings → Environment Variables → add all three:

| Name | Value |
|---|---|
| `DATABASE_URL` | Your production PostgreSQL connection string |
| `JWT_SECRET` | A 64-char random hex string (see below) |
| `NODE_ENV` | `production` |
| `BLOB_READ_WRITE_TOKEN` | From your Vercel Blob store |

Generate `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Step 6 — Run database migrations against production

Run this locally (not during Vercel build):

```bash
DATABASE_URL="your-production-connection-string" npm run db:migrate
```

This applies all SQL files in `migrations/` and creates all tables.

Verify:
```bash
DATABASE_URL="your-production-connection-string" npm run db:audit
```

---

## Step 7 — Seed the database

Run once to insert roles (buyer, seller, admin) and categories:

```bash
DATABASE_URL="your-production-connection-string" npm run db:seed
```

This is idempotent — safe to run multiple times. The app also auto-seeds roles on every cold start, but this script ensures categories exist before the first request.

---

## Step 8 — Redeploy on Vercel

Vercel dashboard → your project → Deployments → Redeploy the latest deployment (or push a new commit).

---

## Step 9 — Test the API

```bash
# Health check
curl https://your-app.vercel.app/api/categories

# Should return array of 8 categories
```

Also test:
```bash
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","firstName":"Test"}'
```

---

## Step 10 — Create the first admin user

1. Register a user via the UI: `https://your-app.vercel.app/register`
2. Note the user ID from the response, or query the DB:
   ```sql
   SELECT id, email FROM users WHERE email = 'your@email.com';
   ```
3. Assign admin role:
   ```bash
   DATABASE_URL="your-production-connection-string" npm run assign-admin -- <user-id>
   ```
4. Log in at `https://your-app.vercel.app/login`
5. You should see the Admin Dashboard icon in the header

---

## Step 11 — Test the full seller approval flow

1. Register a new user
2. Apply to become a seller at `/become-seller`
3. Log in as admin → open Admin Dashboard
4. Approve the seller application
5. Log in as the seller → go to `/seller/dashboard`
6. Create a product with images (images upload to Vercel Blob)
7. Log in as a buyer → browse, add to cart, checkout (guest or authenticated)

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Always | PostgreSQL connection string |
| `JWT_SECRET` | Always | Min 32 chars; signs JWT tokens |
| `NODE_ENV` | Always | Set to `production` on Vercel |
| `BLOB_READ_WRITE_TOKEN` | Production only | Vercel Blob store token for file uploads |
| `PORT` | Local dev only | Default 5000; ignored by Vercel |

---

## Vercel Build Settings (dashboard)

| Setting | Value |
|---|---|
| Build Command | `npm run build:vercel` |
| Output Directory | `dist/public` |
| Install Command | `npm install` |
| Node.js Version | 20.x |

These are already set in `vercel.json` and override whatever the dashboard shows.

---

## Production Migration Command

```bash
# Apply schema changes to production database
DATABASE_URL="postgresql://..." npm run db:migrate

# Audit production database after migration
DATABASE_URL="postgresql://..." npm run db:audit
```

**Never run `db:push` against production** — it may drop columns. Always use `db:generate` + `db:migrate`.

---

## Upload Storage

| Environment | Storage | Image URLs |
|---|---|---|
| Local dev | `uploads/` directory | `/objects/<uuid>` |
| Vercel production | Vercel Blob | `https://<store>.public.blob.vercel-storage.com/<uuid>` |

The two-step upload flow (`POST /api/uploads/request-url` → `PUT /api/uploads/:id`) works identically in both environments. The difference is only in where the binary is stored and what URL is returned.

---

## Remaining Risks

| Risk | Mitigation |
|---|---|
| `bcrypt` native binary compatibility | Vercel builds on Linux x64 — same arch as Lambda. If issues arise, switch to `bcryptjs` (pure JS drop-in) |
| Vercel function cold start | Seed queries run on first request per container. 4 fast DB queries — acceptable latency |
| Vercel function timeout (10s hobby, 60s pro) | All handlers are fast I/O; no long-running processes |
| Vercel Blob upload size limit | 500 MB per upload on hobby plan. Product images are well within this |
| WebSocket (`ws` package) | Listed in deps but not used in any route. Vercel does not support WebSocket upgrades |
| DB connection pool | `pg.Pool` is created at module init. Vercel functions reuse the pool on warm containers |

---

## Local Development (unchanged)

```bash
cp .env.example .env
# Edit .env with your local DATABASE_URL and JWT_SECRET

npm run db:migrate    # create tables
npm run db:seed       # seed roles and categories
npm run dev           # start dev server on port 5000
```
