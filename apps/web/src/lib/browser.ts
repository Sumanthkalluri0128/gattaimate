export async function readBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function downloadBlob(blob: Blob, filename: string): number {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return blob.size;
}

export function downloadBytes(bytes: Uint8Array, filename: string, type = "application/pdf"): number {
  return downloadBlob(new Blob([bytes as BlobPart], { type }), filename);
}

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const isPdfFile = (file: { name: string; type?: string }) =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);
export const isImageFile = (file: { name: string; type?: string }) =>
  file.type === "image/jpeg" || file.type === "image/png" || /\.(jpe?g|png)$/i.test(file.name);

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** True when an error from the PDF engine means the file needs a password. */
export const isLockedError = (error: unknown) => error instanceof Error && /password-protected/i.test(error.message);

/** Cheap check for the /Encrypt entry that every encrypted PDF has in its (never compressed) trailer. */
export const looksEncrypted = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes).includes("/Encrypt");
