import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server configuration error" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    if (!payload.sub) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    req.user = { id: payload.sub as string };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  authenticateJWT(req, res, next);
}

export function requireRole(roleName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    storage.userHasRole(req.user.id, roleName).then((hasRole) => {
      if (!hasRole) {
        res.status(403).json({ error: `Role '${roleName}' required` });
        return;
      }
      next();
    }).catch(next);
  };
}

export function optionalJWT(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    if (payload.sub) {
      req.user = { id: payload.sub as string };
    }
  } catch {
    // Invalid token — treat as unauthenticated for optional routes
  }
  next();
}
