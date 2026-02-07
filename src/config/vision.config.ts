import vision from "@google-cloud/vision";
import { appConfig } from "./app.config";

const credentials = JSON.parse(
  Buffer.from(appConfig.GOOGLE_APPLICATION_CREDENTIALS, "base64").toString(),
);

export const visionClient = new vision.ImageAnnotatorClient({ credentials });
