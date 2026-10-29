import { v2 as cloudinary } from "cloudinary";
import { appConfig } from "../config/app.config";

let initialized = false;

function ensureInit() {
  if (initialized) return;
  cloudinary.config({
    cloud_name: appConfig.CLOUDINARY_CLOUD_NAME,
    api_key: appConfig.CLOUDINARY_API_KEY,
    api_secret: appConfig.CLOUDINARY_API_SECRET,
  });
  initialized = true;
}

export async function uploadToStorage(
  localFilePath: string,
  folder: "prescriptions" | "test-reports"
): Promise<string> {
  ensureInit();

  const result = await cloudinary.uploader.upload(localFilePath, {
    folder,
    resource_type: "auto",
    timeout: 30000,
  });

  console.log(`☁️  Uploaded to Cloudinary: ${result.secure_url}`);
  return result.secure_url;
}

export async function deleteFromStorage(publicUrl: string): Promise<void> {
  try {
    ensureInit();
    const parts = publicUrl.split("/");
    const folderAndFile = parts.slice(-2).join("/");
    const publicId = folderAndFile.replace(/\.[^/.]+$/, "");
    await cloudinary.uploader.destroy(publicId);
    console.log(`🗑️  Deleted from Cloudinary: ${publicId}`);
  } catch {
    // ignore
  }
}
