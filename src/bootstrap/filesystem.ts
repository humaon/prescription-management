import fs from "fs/promises";
import path from "path";
import { appConfig } from "../config/app.config";

export async function setupFileSystem() {
  const uploadDir = path.resolve(process.cwd(), appConfig.UPLOAD_DIR);

  try {
    await fs.mkdir(uploadDir, { recursive: true });
    console.log(`✅ Upload dir ready: ${uploadDir}`);
  } catch (err) {
    console.error("❌ Failed to setup filesystem:", err);
    throw err;
  }
}
