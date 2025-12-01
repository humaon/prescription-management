import { Router } from "express";
import {
  prescriptionGetAllController,
  prescriptionGetByIdController,
  prescriptionUploadController,
} from "../controllers/prescription.controller";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.post("/", upload.single("image"), prescriptionUploadController);
router.get("/", prescriptionGetAllController);
router.get("/:id", prescriptionGetByIdController);

export default router;
