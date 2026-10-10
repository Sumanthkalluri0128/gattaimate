/** Lightweight byte-level sniffing so we never trust a file extension alone. */

export type ImageKind = "jpeg" | "png";

export function sniffImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";
  return null;
}

export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = Math.min(bytes.length, 1024);
  for (let i = 0; i + 4 <= head; i++) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46) return true;
  }
  return false;
}

/**
 * Read the EXIF orientation (1-8) from a JPEG. Phone cameras store photos in sensor
 * orientation and rely on this tag, so ignoring it produces sideways pages.
 * Returns 1 (normal) when the tag is missing or unreadable.
 */
export function readJpegOrientation(bytes: Uint8Array): number {
  try {
    if (sniffImageKind(bytes) !== "jpeg") return 1;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return 1;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xda || marker === 0xd9) return 1; // start of scan / end of image
      const length = view.getUint16(offset + 2);
      if (marker === 0xe1 && view.getUint32(offset + 4) === 0x45786966 /* "Exif" */) {
        const tiff = offset + 10;
        const little = view.getUint16(tiff) === 0x4949;
        const ifd = tiff + view.getUint32(tiff + 4, little);
        const entries = view.getUint16(ifd, little);
        for (let i = 0; i < entries; i++) {
          const entry = ifd + 2 + i * 12;
          if (view.getUint16(entry, little) === 0x0112) {
            const value = view.getUint16(entry + 8, little);
            return value >= 1 && value <= 8 ? value : 1;
          }
        }
        return 1;
      }
      offset += 2 + length;
    }
  } catch {
    /* fall through: treat malformed EXIF as "no rotation" */
  }
  return 1;
}
