// Vercel serverless function entry point.
// Imports dotenv first so DATABASE_URL / JWT_SECRET are available when server/app.ts
// evaluates its module-level guards (works because static imports are evaluated in order).
import "dotenv/config";
import app from "../server/app";

export default app;
