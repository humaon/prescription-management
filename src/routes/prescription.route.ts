import { Router } from "express";
import multer from "multer";
import { prescriptionCreateController } from "../controllers/prescription.controller";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.get("/", (_req, res) => {
  res.json({ message: "List of prescriptions" });
});

router.post("/", upload.single("image"), prescriptionCreateController);

export default router;
