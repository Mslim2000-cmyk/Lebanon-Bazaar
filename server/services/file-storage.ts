import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Only create local uploads directory in development — Vercel filesystem is read-only
if (!IS_PRODUCTION) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function safeFileId(raw: string | string[]): string | null {
  const id = Array.isArray(raw) ? raw[0] : raw;
  return UUID_RE.test(id) ? id : null;
}

export function registerUploadRoutes(app: Express): void {
  // Step 1: client requests an upload slot
  // Returns uploadURL (where to PUT the binary) and objectPath (the stored image URL)
  // In production, objectPath will be the actual Vercel Blob URL returned from the PUT response
  app.post("/api/uploads/request-url", (_req: Request, res: Response) => {
    const fileId = randomUUID();
    res.json({
      uploadURL: `/api/uploads/${fileId}`,
      // In production the real URL comes from the PUT response; client overrides this value
      objectPath: IS_PRODUCTION ? "" : `/objects/${fileId}`,
    });
  });

  // Step 2: client PUT-uploads the file binary
  // Dev: streams to local uploads/ directory
  // Production: streams to Vercel Blob and returns the public blob URL as objectPath
  app.put("/api/uploads/:fileId", async (req: Request, res: Response) => {
    const fileId = safeFileId(req.params.fileId);
    if (!fileId) {
      res.status(400).json({ error: "Invalid file ID" });
      return;
    }

    if (IS_PRODUCTION) {
      try {
        const { put } = await import("@vercel/blob");
        const contentType =
          (req.headers["content-type"] as string) || "application/octet-stream";
        const blob = await put(fileId, req, {
          access: "public",
          contentType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        res.json({ success: true, objectPath: blob.url });
      } catch (err) {
        console.error("Vercel Blob upload error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Upload failed" });
        }
      }
      return;
    }

    // Development: pipe to local filesystem
    const filePath = path.join(UPLOADS_DIR, fileId);
    const writeStream = fs.createWriteStream(filePath);

    req.pipe(writeStream);

    writeStream.on("finish", () => {
      res.json({ success: true, objectPath: `/objects/${fileId}` });
    });

    writeStream.on("error", (err) => {
      console.error("File upload error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Upload failed" });
      }
    });

    req.on("error", () => {
      writeStream.destroy();
    });
  });

  // Serve uploaded files — development only
  // In production, objectPath is a Vercel Blob URL served directly from blob storage
  app.get("/objects/:fileId", (req: Request, res: Response) => {
    const fileId = safeFileId(req.params.fileId);
    if (!fileId) {
      res.status(400).json({ error: "Invalid file ID" });
      return;
    }

    if (IS_PRODUCTION) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, fileId);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.sendFile(filePath);
  });
}
