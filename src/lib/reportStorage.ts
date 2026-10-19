// Test report files: Cloud Storage when REPORTS_BUCKET is set, else local disk.
// Stored keys: "gs:<object path>" or "local:<file name in UPLOAD_DIR/reports>".
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import admin from "firebase-admin";
import { appConfig } from "../config/app.config";
import { initializeFirebase } from "../services/notification.service";

const localDir = () => path.join(appConfig.UPLOAD_DIR, "reports");

const bucket = () => {
  initializeFirebase();
  return admin.storage().bucket(appConfig.REPORTS_BUCKET);
};

/** Moves an uploaded temp file into report storage; returns its key */
export const saveReport = async (tmpPath: string, mimeType: string, userId: string) => {
  const name = crypto.randomUUID();
  try {
    if (appConfig.REPORTS_BUCKET) {
      const objectPath = `reports/${userId}/${name}`;
      await bucket().upload(tmpPath, { destination: objectPath, contentType: mimeType });
      return `gs:${objectPath}`;
    }
    await fs.promises.mkdir(localDir(), { recursive: true });
    await fs.promises.copyFile(tmpPath, path.join(localDir(), name));
    return `local:${name}`;
  } finally {
    await fs.promises.unlink(tmpPath).catch(() => {});
  }
};

/**
 * Opens a stored report. Also accepts the old public URLs
 * ("http://host/uploads/<file>") saved before reports were private.
 */
export const openReport = (key: string): Readable | null => {
  if (key.startsWith("gs:")) {
    return bucket().file(key.slice(3)).createReadStream();
  }
  const file = key.startsWith("local:")
    ? path.join(localDir(), path.basename(key.slice(6)))
    : path.join(appConfig.UPLOAD_DIR, path.basename(new URL(key, "http://x").pathname));
  return fs.existsSync(file) ? fs.createReadStream(file) : null;
};

export const deleteReport = async (key: string | null | undefined) => {
  if (!key) return;
  try {
    if (key.startsWith("gs:")) await bucket().file(key.slice(3)).delete();
    else if (key.startsWith("local:")) {
      await fs.promises.unlink(path.join(localDir(), path.basename(key.slice(6))));
    }
  } catch {
    // already gone
  }
};
