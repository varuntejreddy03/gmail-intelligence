import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth";

type AsyncRouteHandler = (req: AuthenticatedRequest, res: Response, next?: NextFunction) => Promise<any>;

/** Wraps async route handlers to catch errors and send 500 responses. */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch((err) => {
      console.error(`[${req.method} ${req.path}]`, err instanceof Error ? err.message : err);
      if (!res.headersSent) {
        res.status(err?.status || 500).json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
      }
    });
  };
}
