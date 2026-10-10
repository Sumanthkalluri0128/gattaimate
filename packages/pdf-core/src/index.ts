import { PDFDocument } from "pdf-lib";

export type PdfInput = {
  name: string;
  bytes: Uint8Array;
};

export type MergeResult = {
  bytes: Uint8Array;
  pageCount: number;
};

export function validatePdfInputs(files: PdfInput[]): void {
  if (files.length < 2) {
    throw new Error("Choose at least two PDF files to merge.");
  }

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error(`"${file.name}" does not look like a PDF file.`);
    }
    if (!file.bytes || file.bytes.byteLength === 0) {
      throw new Error(`"${file.name}" is empty or could not be read.`);
    }
  }
}

/**
 * Merges the input PDFs in the exact order provided.
 * This operates on bytes only, so web and native apps can supply their own
 * file-reading and output-saving adapters.
 */
export async function mergePdfBuffers(files: PdfInput[]): Promise<MergeResult> {
  validatePdfInputs(files);

  const output = await PDFDocument.create();
  let totalPages = 0;

  for (const file of files) {
    let source: PDFDocument;

    try {
      source = await PDFDocument.load(file.bytes, {
        updateMetadata: false,
        ignoreEncryption: false
      });
    } catch {
      throw new Error(
        `Could not open "${file.name}". It may be damaged, encrypted, or not a supported PDF.`
      );
    }

    const pageIndices = source.getPageIndices();
    if (pageIndices.length === 0) {
      throw new Error(`"${file.name}" does not contain any pages.`);
    }

    const copiedPages = await output.copyPages(source, pageIndices);
    for (const page of copiedPages) output.addPage(page);
    totalPages += copiedPages.length;
  }

  const bytes = await output.save({ useObjectStreams: true });
  return { bytes, pageCount: totalPages };
}
