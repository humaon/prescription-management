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

  const decoded = verifyToken(token) as { id: string };
  if (!decoded) {
    res.status(403).json({ error: "Invalid token" });
    return;
  }

  req.userId = decoded.id;
  next();
}
