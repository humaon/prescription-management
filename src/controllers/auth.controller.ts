import { Request, Response } from "express";
import { MESSAGES } from "../lib/constants";
import { signToken } from "../lib/jwt";
import {
  loginService,
  requestEmailOtpService,
  signupMobileRequestService,
  signupMobileVerifyService,
  signupWithEmailService,
} from "../services/auth.service";

export const requestEmailOtpController = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    await requestEmailOtpService(email);
    res.status(200).json({
      message: "Verification code sent to your email",
      email,
      expiresIn: "5 minutes",
    });
  } catch (err: any) {
    const status = err.message.includes("wait") ? 429 : 409;
    res.status(status).json({ error: err.message });
  }
};

export const signupEmailController = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, code, country } = req.body;
    const { user, token } = await signupWithEmailService(
      email,
      password,
      fullName,
      code,
      country
    );

    res.status(201).json({
      message: MESSAGES.SIGNUP_SUCCESS,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isVerified: user.isVerified,
        country: user.country,
        currency: user.currency,
        language: user.language,
        voiceReminders: user.voiceReminders,
      },
    });
  } catch (err: any) {
    const status = err.message === MESSAGES.INVALID_OTP ? 401 : 409;
    res.status(status).json({ error: err.message });
  }
};

export const signupMobileRequestController = async (
  req: Request,
  res: Response
) => {
  try {
    const { mobileNumber } = req.body;
    await signupMobileRequestService(mobileNumber);

    res.status(200).json({
      message: MESSAGES.OTP_SENT,
      mobileNumber,
      expiresIn: "5 minutes",
    });
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
};

export const signupMobileVerifyController = async (
  req: Request,
  res: Response
) => {
  try {
    const { mobileNumber, code, password, fullName } = req.body;
    const { user, token } = await signupMobileVerifyService(
      mobileNumber,
      code,
      password,
      fullName
    );

    res.status(201).json({
      message: MESSAGES.ACCOUNT_CREATED,
      token,
      user: {
        id: user.id,
        mobileNumber: user.mobileNumber,
        fullName: user.fullName,
        isVerified: user.isVerified,
      },
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
};

export const loginController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await loginService(email, password);

    res.status(200).json({
      message: MESSAGES.LOGIN_SUCCESS,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isVerified: user.isVerified,
        country: user.country,
        currency: user.currency,
        language: user.language,
        voiceReminders: user.voiceReminders,
      },
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
};

export async function googleCallbackController(req: Request, res: Response) {
  try {
    const user = req.user as any;
    const token = signToken({ id: user.id });

    console.log(`✅ User signed up via Google: ${user.email}`);

    res.json({
      message: "Google signup successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isVerified: user.isVerified,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
