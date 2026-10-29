import { Router } from "express";
import {
  listProfilesController,
  createProfileController,
  updateProfileMemberController,
  deleteProfileController,
  getAllergiesController,
  updateAllergiesController,
  getProfileController,
  getReminderSettingsController,
  updateProfileController,
  updateReminderSettingsController,
} from "../controllers/user.controller";
import { authenticate } from "../middleware/authenticate.middleware";

const router = Router();

router.get("/profile", authenticate, getProfileController);
router.put("/profile", authenticate, updateProfileController);
router.get("/reminder-settings", authenticate, getReminderSettingsController);
router.get("/profiles", authenticate, listProfilesController);
router.post("/profiles", authenticate, createProfileController);
router.put("/profiles/:id", authenticate, updateProfileMemberController);
router.delete("/profiles/:id", authenticate, deleteProfileController);
router.get("/allergies", authenticate, getAllergiesController);
router.put("/allergies", authenticate, updateAllergiesController);
router.put("/reminder-settings", authenticate, updateReminderSettingsController);

export default router;
