import { Router } from "express";
import passport from "passport";
import { authenticate } from "../middleware/authenticate.middleware";
import {
  deleteAccountController,
  googleCallbackController,
  loginController,
  signupEmailController,
  signupMobileRequestController,
  signupMobileVerifyController,
} from "../controllers/auth.controller";
import {
  validateOtpVerify,
  validateSignupEmail,
  validateSignupMobile,
} from "../validation/auth.validation";

const router = Router();

router.post("/signup/email", validateSignupEmail, signupEmailController);

router.post(
  "/signup/mobile",
  validateSignupMobile,
  signupMobileRequestController
);

router.post("/verify-otp", validateOtpVerify, signupMobileVerifyController);

router.post("/login", loginController);

// Permanently delete the signed-in user's account and data
router.delete("/me", authenticate, deleteAccountController);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleCallbackController
);

export default router;
