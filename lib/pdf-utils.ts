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
