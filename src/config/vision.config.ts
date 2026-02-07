import vision from "@google-cloud/vision";
import { appConfig } from "./app.config";

export const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: appConfig.GOOGLE_APPLICATION_CREDENTIALS,
});
