import { Router } from "express";
import {
  prescriptionGetAllController,
  prescriptionUploadController,
} from "../controllers/prescription.controller";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.post("/", upload.single("image"), prescriptionUploadController);
router.get("/", prescriptionGetAllController);

export default router;
