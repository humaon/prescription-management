import { Router } from "express";
import {
  prescriptionDeleteByIdController,
  prescriptionGetAllController,
  prescriptionGetByIdController,
  prescriptionUploadController,
} from "../controllers/prescription.controller";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.post("/", upload.single("image"), prescriptionUploadController);
router.get("/", prescriptionGetAllController);
router.get("/:id", prescriptionGetByIdController);
router.delete("/:id", prescriptionDeleteByIdController);

export default router;
