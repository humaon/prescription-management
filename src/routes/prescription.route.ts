import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "List of prescriptions" });
});

export default router;
