import fs from "fs/promises";
import path from "path";
import { appConfig } from "../config/app.config";

export async function cleanupTempFiles() {
  const tempDir = path.resolve(process.cwd(), "temp");

  try {
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log("🧹 Temp files cleaned");
  } catch (err) {
    console.warn("⚠️ Temp cleanup skipped:", err);
  }
}
