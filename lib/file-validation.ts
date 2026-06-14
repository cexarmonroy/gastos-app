const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function startsWithBytes(buffer: Uint8Array, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function detectMimeFromMagicBytes(buffer: Uint8Array): string | null {
  if (startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46])) {
    return "application/pdf";
  }

  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    startsWithBytes(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function validateFileContent(
  buffer: Uint8Array,
  declaredMimeType: string
): { valid: true; mimeType: string } | { valid: false; error: string } {
  if (!ALLOWED_MIME_TYPES.has(declaredMimeType)) {
    return { valid: false, error: "Formato no permitido. Usa PDF, JPG, PNG o WEBP." };
  }

  const detectedMime = detectMimeFromMagicBytes(buffer);
  if (!detectedMime) {
    return { valid: false, error: "El contenido del archivo no coincide con un formato permitido." };
  }

  if (detectedMime !== declaredMimeType) {
    return { valid: false, error: "El tipo declarado del archivo no coincide con su contenido real." };
  }

  return { valid: true, mimeType: detectedMime };
}
