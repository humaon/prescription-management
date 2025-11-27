import { Router } from "express";
import { prescriptionUploadController } from "../controllers/prescription.controller";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "List of prescriptions" });
});

router.post("/upload", upload.single("image"), prescriptionUploadController);

export default router;
