import jwt from "jsonwebtoken";
import { appConfig } from "../config/app.config";

export function signToken(payload: object) {
  return jwt.sign(payload, appConfig.JWT_SECRET, {
    expiresIn: appConfig.JWT_EXPIRES_IN as any,
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, appConfig.JWT_SECRET);
}
