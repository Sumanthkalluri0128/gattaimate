import { PDFDocument, degrees } from "pdf-lib";

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

/** Parse 1-based page selections such as "1-3,5,8-9" into zero-based indices. */
export function parsePageRanges(input: string, pageCount: number): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error("The PDF has no pages.");
  const value = input.trim();
  if (!value) throw new Error("Enter page numbers, for example 1-3,5.");
  const selected = new Set<number>();
  for (const token of value.split(",").map((part) => part.trim())) {
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`Invalid page range: "${token}". Use a format such as 1-3,5.`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`Page range "${token}" is outside this document (1-${pageCount}).`);
    }
    for (let page = start; page <= end; page++) selected.add(page - 1);
  }
  return [...selected].sort((a, b) => a - b);
}

export async function extractPdfPages(bytes: Uint8Array, pageRange: string): Promise<MergeResult> {
  const source = await PDFDocument.load(bytes, { updateMetadata: false });
  const indices = parsePageRanges(pageRange, source.getPageCount());
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, indices);
  pages.forEach((page) => output.addPage(page));
  return { bytes: await output.save({ useObjectStreams: true }), pageCount: pages.length };
}

/** Create one PDF per comma-separated group, e.g. "1-2,3-5,6". */
export async function splitPdfByRanges(bytes: Uint8Array, ranges: string): Promise<MergeResult[]> {
  const source = await PDFDocument.load(bytes, { updateMetadata: false });
  // Semicolons separate output files; commas inside a group select pages within that file.
  // Backward-compatible comma-only input still treats each comma-delimited token as a group.
  const groups = ranges.includes(";")
    ? ranges.split(";").map((part) => part.trim()).filter(Boolean)
    : ranges.split(",").map((part) => part.trim()).filter(Boolean);
  if (groups.length < 2) throw new Error("Enter at least two page groups. Separate output files with semicolons, e.g. 1-2;3-5;6.");
  const results: MergeResult[] = [];
  for (const group of groups) {
    const indices = parsePageRanges(group, source.getPageCount());
    const output = await PDFDocument.create();
    const pages = await output.copyPages(source, indices);
    pages.forEach((page) => output.addPage(page));
    results.push({ bytes: await output.save({ useObjectStreams: true }), pageCount: pages.length });
  }
  return results;
}

/** Rotate all pages or selected 1-based pages by 90, 180, or 270 degrees. */
export async function rotatePdfPages(bytes: Uint8Array, degreesToAdd: 90 | 180 | 270, pageRange = "all"): Promise<MergeResult> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const indices = pageRange.trim().toLowerCase() === "all"
    ? doc.getPageIndices()
    : parsePageRanges(pageRange, doc.getPageCount());
  for (const index of indices) {
    const page = doc.getPage(index);
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + degreesToAdd) % 360));
  }
  return { bytes: await doc.save({ useObjectStreams: true }), pageCount: doc.getPageCount() };
}

/** Re-save using object streams and remove document metadata. This is a best-effort structural optimization, not lossy image recompression. */
export async function optimizePdf(bytes: Uint8Array): Promise<MergeResult> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("GattaiMate");
  doc.setCreator("GattaiMate");
  const optimized = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  return { bytes: optimized, pageCount: doc.getPageCount() };
}
