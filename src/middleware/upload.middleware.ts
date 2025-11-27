import multer from "multer";
import { appConfig } from "../config/app.config";

const storage = multer.diskStorage({
  destination: appConfig.UPLOAD_DIR,
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

export const upload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});
