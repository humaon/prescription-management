import Tesseract from "tesseract.js";

export const extractText = async (path: string) => {
  const result = await Tesseract.recognize(path, "eng");
  return result.data.text;
};
