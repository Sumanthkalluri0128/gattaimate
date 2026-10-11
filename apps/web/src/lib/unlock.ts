import { readBytes } from "./browser";

/** Open a password-protected PDF in memory and return an unprotected copy (same name). The original is never touched. */
export async function openLockedPdf(file: File, password: string): Promise<File> {
  const { unlockPdf } = await import("./qpdf");
  const bytes = await unlockPdf(await readBytes(file), password);
  return new File([bytes as BlobPart], file.name, { type: "application/pdf", lastModified: file.lastModified });
}
