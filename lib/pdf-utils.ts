import type jsPDF from "jspdf";
import { NOTO_SANS_REGULAR_BASE64 } from "@/lib/finance/fonts/noto-sans-regular";

/** Font name to use with `doc.setFont(REPORT_FONT, ...)` after calling `registerReportFont`. */
export const REPORT_FONT = "NotoSans";

/**
 * Embeds a Unicode TTF font so jsPDF reports can render Spanish accents and ñ.
 * The 3 standard PDF fonts (Helvetica/Times/Courier) require manual glyph
 * workarounds for anything outside a narrow character set, which is why
 * PDF exports used to strip diacritics before this was added.
 */
export function registerReportFont(doc: jsPDF): void {
  doc.addFileToVFS("NotoSans-Regular.ttf", NOTO_SANS_REGULAR_BASE64);
  doc.addFont("NotoSans-Regular.ttf", REPORT_FONT, "normal");
  // No bold weight is embedded; alias it to the regular glyphs so
  // setFont(REPORT_FONT, "bold") still resolves instead of falling back
  // to Helvetica (which loses accents/ñ).
  doc.addFont("NotoSans-Regular.ttf", REPORT_FONT, "bold");
  doc.setFont(REPORT_FONT, "normal");
}

/**
 * Converts an image path/URL to a Base64 string.
 * Since this runs on the client-side in Next.js, we use a canvas to perform the conversion.
 */
export const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  const res = await fetch(imageUrl);
  const blob = await res.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as string));
    reader.addEventListener("error", () => reject(new Error("Failed to convert image to Base64")));
    reader.readAsDataURL(blob);
  });
};
