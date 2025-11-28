import { Request, Response } from "express";
import { signToken } from "../lib/jwt";
import { User } from "../models/user.model";
import { createOTP, verifyOTP } from "../services/otp.service";

export const otpSendController = async (req: Request, res: Response) => {
  const { mobileNumber } = req.body;
  await createOTP(mobileNumber);
  res.json({ message: "OTP sent (console)" });
};

export const otpVerifyController = async (req: Request, res: Response) => {
  const { mobileNumber, code } = req.body;

  const valid = await verifyOTP(mobileNumber, code);
  if (!valid) return res.status(400).json({ message: "Invalid OTP" });

  let user = await User.findOne({ mobileNumber });
  if (!user) {
    user = await User.create({ mobileNumber, isVerified: true });
  }

  const token = signToken(user.id);
  res.json({ accessToken: token });
};
