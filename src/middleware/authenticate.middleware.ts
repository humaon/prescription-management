import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  let decoded: { id: string } | undefined;
  try {
    decoded = verifyToken(token) as { id: string };
  } catch {
    res.status(401).json({ error: "Session expired. Please sign in again." });
    return;
  }
  if (!decoded?.id) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  req.userId = decoded.id;
  next();
}
