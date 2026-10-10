/** File-name helpers shared by the web and mobile apps. */

export const isPdfName = (name: string) => /\.pdf$/i.test(name);
export const isImageName = (name: string) => /\.(jpe?g|png)$/i.test(name);
export const isSupportedName = (name: string) => isPdfName(name) || isImageName(name);

/** File name without a supported extension. */
export const baseName = (name: string) => name.replace(/\.(pdf|jpe?g|png)$/i, "").trim();

/** Remove characters that are illegal on common file systems and keep the name a sensible length. */
export function sanitizeFileName(name: string, fallback = "gattaimate"): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120);
  return cleaned || fallback;
}

/** Sanitise `name` and make sure it ends with `ext` (e.g. ".pdf"). */
export function withExtension(name: string, ext: string, fallback = "gattaimate"): string {
  const dotted = ext.startsWith(".") ? ext : `.${ext}`;
  const clean = sanitizeFileName(name.replace(new RegExp(`\\${dotted}$`, "i"), ""), fallback);
  return `${clean}${dotted}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
