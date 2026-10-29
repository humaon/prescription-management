import { Request, Response, NextFunction } from "express";

// Reject objects/arrays (e.g. {"$ne": null}) so values can never act as Mongo operators
const allStrings = (...values: unknown[]) =>
  values.every((v) => typeof v === "string");

export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password } = req.body || {};
  if (!allStrings(email, password) || !email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  next();
};

export const validateEmailOtpRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email } = req.body || {};
  if (!allStrings(email) || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }
  next();
};

export const validateSignupEmail = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password, fullName, code, country } = req.body || {};

  if (
    !allStrings(email, password, fullName, code) ||
    (country !== undefined && !allStrings(country)) ||
    !email ||
    !password ||
    !fullName ||
    !code
  ) {
    res
      .status(400)
      .json({ error: "Email, password, fullName and verification code required" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  next();
};

export const validateSignupMobile = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { mobileNumber, password, fullName } = req.body;

  if (!mobileNumber || !password || !fullName) {
    res.status(400).json({ error: "Mobile, password, and fullName required" });
    return;
  }

  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(mobileNumber)) {
    res.status(400).json({ error: "Invalid mobile number format" });
    return;
  }

  next();
};

export const validateOtpVerify = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { mobileNumber, code, password, fullName } = req.body;

  if (!mobileNumber || !code || !password || !fullName) {
    res.status(400).json({ error: "All fields required" });
    return;
  }

  if (code.length !== 6) {
    res.status(400).json({ error: "OTP must be 6 digits" });
    return;
  }

  next();
};
