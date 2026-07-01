import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeFileId(raw: string | string[]): string | null {
  const id = Array.isArray(raw) ? raw[0] : raw;
  return UUID_RE.test(id) ? id : null;
}

export function registerUploadRoutes(app: Express): void {
  // Step 1: Client requests an upload slot — returns an upload URL and the final object path
  app.post("/api/uploads/request-url", (_req: Request, res: Response) => {
    const fileId = randomUUID();
    res.json({
      uploadURL: `/api/uploads/${fileId}`,
      objectPath: `/objects/${fileId}`,
    });
  });

  // Step 2: Client PUT-uploads the raw binary to the URL from step 1
  app.put("/api/uploads/:fileId", (req: Request, res: Response) => {
    const fileId = safeFileId(req.params.fileId);
    if (!fileId) {
      res.status(400).json({ error: "Invalid file ID" });
      return;
    }

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

    req.on("error", (err) => {
      console.error("Request stream error:", err);
      writeStream.destroy();
    });
  });

  // Serve uploaded files
  app.get("/objects/:fileId", (req: Request, res: Response) => {
    const fileId = safeFileId(req.params.fileId);
    if (!fileId) {
      res.status(400).json({ error: "Invalid file ID" });
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
