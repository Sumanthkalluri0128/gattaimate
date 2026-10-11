import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { fromByteArray, toByteArray } from "base64-js";
import { isImageName, isPdfName, sanitizeFileName } from "@gattaimate/pdf-core";

export type Picked = { id: string; name: string; uri: string; size?: number; mimeType?: string | null };
export type PickKind = "pdf" | "image" | "any";

const MIME: Record<PickKind, string[]> = {
  pdf: ["application/pdf"],
  image: ["image/jpeg", "image/png"],
  any: ["application/pdf", "image/jpeg", "image/png"]
};

const accepts = (kind: PickKind, name: string, mime?: string | null) => {
  const pdf = isPdfName(name) || mime === "application/pdf";
  const image = isImageName(name) || mime === "image/jpeg" || mime === "image/png";
  return kind === "pdf" ? pdf : kind === "image" ? image : pdf || image;
};

/** Open the system picker. Returns only files that match `kind`; the count of rejected files is reported too. */
export async function pickFiles(kind: PickKind, multiple: boolean): Promise<{ files: Picked[]; rejected: number }> {
  const result = await DocumentPicker.getDocumentAsync({ type: MIME[kind], multiple, copyToCacheDirectory: true });
  if (result.canceled) return { files: [], rejected: 0 };
  const files = result.assets
    .filter((asset) => accepts(kind, asset.name, asset.mimeType))
    .map((asset) => ({ id: `${asset.uri}#${Math.random().toString(36).slice(2)}`, name: asset.name, uri: asset.uri, size: asset.size, mimeType: asset.mimeType }));
  return { files, rejected: result.assets.length - files.length };
}

export async function readBytes(uri: string): Promise<Uint8Array> {
  return toByteArray(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));
}

const UTI: Record<string, string> = { "application/pdf": "com.adobe.pdf", "application/zip": "public.zip-archive", "image/jpeg": "public.jpeg", "image/png": "public.png" };

/** Write bytes to the app cache and open the share sheet so the user can save or send the result. */
export async function saveAndShare(bytes: Uint8Array, filename: string, mimeType: string): Promise<{ uri: string; size: number; shared: boolean }> {
  const uri = `${FileSystem.cacheDirectory}${sanitizeFileName(filename)}`;
  await FileSystem.writeAsStringAsync(uri, fromByteArray(bytes), { encoding: FileSystem.EncodingType.Base64 });
  return { uri, size: bytes.byteLength, ...(await shareUri(uri, mimeType, filename)) };
}

export async function shareUri(uri: string, mimeType: string, title: string): Promise<{ shared: boolean }> {
  if (!(await Sharing.isAvailableAsync())) return { shared: false };
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title, UTI: UTI[mimeType] });
  return { shared: true };
}

export async function fileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && "size" in info ? info.size : 0;
}

/** Share an already-written file (e.g. image-manipulator output). Returns whether the share sheet opened. */
export async function saveCopy(uri: string, mimeType: string, title: string): Promise<boolean> {
  return (await shareUri(uri, mimeType, title)).shared;
}

/** Open a PDF in the phone's PDF viewer via the share sheet. */
export async function openInViewer(uri: string, title: string): Promise<void> {
  await shareUri(uri, "application/pdf", title);
}

/** The phone app can't unlock PDFs (no WebAssembly), so say exactly where to do it. */
export function lockedHint(name: string): string {
  return `“${name}” is password-protected. The Android app can't unlock PDFs yet — open it in the web app (Protect / Unlock → Remove password), then use the unlocked copy here.`;
}
export const isLockedMessage = (error: unknown) => error instanceof Error && /password-protected/i.test(error.message);
