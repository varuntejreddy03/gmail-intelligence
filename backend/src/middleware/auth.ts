import type { Request, Response, NextFunction } from "express";
import { config } from "../config";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  accessToken?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const secret = req.headers["x-internal-secret"] as string | undefined;

  if (!config.internalSecret || secret !== config.internalSecret) {
    res.status(401).json({ error: "Unauthorized", code: "INVALID_SECRET" });
    return;
  }

  req.userId = req.headers["x-user-id"] as string | undefined;
  req.accessToken = req.headers["x-access-token"] as string | undefined;

  if (!req.userId) {
    res.status(401).json({ error: "Missing user context", code: "NO_USER" });
    return;
  }

  next();
}
