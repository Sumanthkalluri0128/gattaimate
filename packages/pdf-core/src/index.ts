import { PDFDocument } from "pdf-lib";

export type PdfInput = {
  name: string;
  bytes: Uint8Array;
};

export type MergeResult = {
  bytes: Uint8Array;
  pageCount: number;
};

const isPdf = (name: string) => name.toLowerCase().endsWith(".pdf");
const isJpeg = (name: string) => /\.(jpe?g)$/i.test(name);
const isPng = (name: string) => name.toLowerCase().endsWith(".png");
const isSupportedImage = (name: string) => isJpeg(name) || isPng(name);

export function validatePdfInputs(files: PdfInput[]): void {
  if (files.length < 1) {
    throw new Error("Choose at least one PDF or image file.");
  }

  for (const file of files) {
    if (!isPdf(file.name) && !isSupportedImage(file.name)) {
      throw new Error(`\"${file.name}\" is not supported. Choose PDF, JPG, JPEG, or PNG files.`);
    }
    if (!file.bytes || file.bytes.byteLength === 0) {
      throw new Error(`\"${file.name}\" is empty or could not be read.`);
    }
  }
}

/**
 * Combines PDFs and image files in the exact order supplied. Each JPG/JPEG/PNG
 * becomes one page sized to fit an A4 portrait page while preserving aspect ratio.
 * All processing happens in memory, so no backend or upload is required.
 */
export async function mergePdfBuffers(files: PdfInput[]): Promise<MergeResult> {
  validatePdfInputs(files);

  const output = await PDFDocument.create();
  let totalPages = 0;

  for (const file of files) {
    if (isSupportedImage(file.name)) {
      try {
        const image = isPng(file.name)
          ? await output.embedPng(file.bytes)
          : await output.embedJpg(file.bytes);
        const pageWidth = 595.28; // A4 at 72 DPI, points
        const pageHeight = 841.89;
        const margin = 24;
        const scale = Math.min((pageWidth - margin * 2) / image.width, (pageHeight - margin * 2) / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const page = output.addPage([pageWidth, pageHeight]);
        page.drawImage(image, {
          x: (pageWidth - width) / 2,
          y: (pageHeight - height) / 2,
          width,
          height
        });
        totalPages += 1;
      } catch {
        throw new Error(`Could not open image \"${file.name}\". It may be damaged or use an unsupported image format.`);
      }
      continue;
    }

    let source: PDFDocument;
    try {
      source = await PDFDocument.load(file.bytes, {
        updateMetadata: false,
        ignoreEncryption: false
      });
    } catch {
      throw new Error(
        `Could not open \"${file.name}\". It may be damaged, encrypted, or not a supported PDF.`
      );
    }

    const pageIndices = source.getPageIndices();
    if (pageIndices.length === 0) {
      throw new Error(`\"${file.name}\" does not contain any pages.`);
    }

    const copiedPages = await output.copyPages(source, pageIndices);
    for (const page of copiedPages) output.addPage(page);
    totalPages += copiedPages.length;
  }

  const bytes = await output.save({ useObjectStreams: true });
  return { bytes, pageCount: totalPages };
}
