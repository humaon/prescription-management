import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { runWithProfile } from "../lib/requestScope";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      profileId?: Types.ObjectId | null;
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

  // Expired, malformed or tampered tokens must be 401 so the app logs the user out
  let decoded: { id: string };
  try {
    decoded = verifyToken(token) as { id: string };
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Tokens of deleted accounts must stop working immediately
  const user = decoded?.id
    ? await User.findById(decoded.id).select("profiles._id").lean()
    : null;
  if (!user) {
    res.status(401).json({ error: "Account not found" });
    return;
  }

  // Family profile this request is for (absent / "self" = the account holder)
  const header = req.get("x-profile-id");
  let profileId: Types.ObjectId | null = null;
  if (header && header !== "self") {
    const owned = (user.profiles ?? []).some((p: any) => p._id.toString() === header);
    if (!Types.ObjectId.isValid(header) || !owned) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    profileId = new Types.ObjectId(header);
  }

  req.userId = decoded.id;
  req.profileId = profileId;
  runWithProfile(profileId, () => next());
}
