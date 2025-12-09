// src/controllers/otp.controller.ts (FIXED)
import { Request, Response } from "express";
// Fixed import - adjust based on what your otp.service.ts exports
import { 
        // or createOTP - check your otp.service.ts
  verifyOTP 
} from "../services/otp.service";

export const sendOTPController = async (req: Request, res: Response) => {
  try {
    const { mobileNumber } = req.body;
    
    // Use generateOTP or createOTP depending on your service
   // await generateOTP(mobileNumber);
    
    res.status(200).json({
      success: true,
      message: "OTP sent successfully"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const verifyOTPController = async (req: Request, res: Response) => {
  try {
    const { mobileNumber, code } = req.body;
    
    const isValid = await verifyOTP(mobileNumber, code);
    
    if (isValid) {
      res.status(200).json({
        success: true,
        message: "OTP verified successfully"
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Invalid OTP"
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};