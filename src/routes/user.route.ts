import { Router } from "express";
import {
  getProfileController,
  updateProfileController,
} from "../controllers/user.controller";
import { authenticate } from "../middleware/authenticate.middleware";

const router = Router();

router.get("/profile", authenticate, getProfileController);
router.put("/profile", authenticate, updateProfileController);

export default router;
