import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerUploadRoutes } from "./services/file-storage";
import { seedDatabase } from "./seed";

// Augment the http.IncomingMessage type for rawBody access in JSON verify
declare global {
  namespace Express {
    // Merged with auth.ts middleware augmentation
  }
}
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

// Request logging for /api/* paths
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// File upload/serve routes (local filesystem in dev, Vercel Blob in production)
registerUploadRoutes(app);

// Seed once per container lifetime — idempotent, safe on repeated cold starts
let seedPromise: Promise<void> | null = null;
app.use(async (_req, _res, next) => {
  try {
    if (!seedPromise) {
      seedPromise = seedDatabase();
    }
    await seedPromise;
    next();
  } catch (err) {
    next(err);
  }
});

// All API routes — registered synchronously at import time
registerRoutes(app);

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Unhandled error:", err);
  if (!res.headersSent) {
    res.status(status).json({ message });
  }
});

export default app;
