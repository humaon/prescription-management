import { Request, Response, NextFunction } from "express";

export const validateSignupEmail = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password, fullName } = req.body;

  if (!email || !password || !fullName) {
    res.status(400).json({ error: "Email, password, and fullName required" });
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
