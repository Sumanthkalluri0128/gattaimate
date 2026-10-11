import { PDFDocument, degrees, type PDFImage } from "pdf-lib";
import { isImageName, isPdfName, isSupportedName } from "./files";
import { looksLikePdf, readJpegOrientation, sniffImageKind, type ImageKind } from "./images";
import { parsePageRanges, parseSplitGroups, resolvePages } from "./ranges";

export type Rotation = 0 | 90 | 180 | 270;
/** `rotation` is an optional extra clockwise turn applied to every page of this input when merging. */
export type PdfInput = { name: string; bytes: Uint8Array; rotation?: Rotation };
export type MergeResult = { bytes: Uint8Array; pageCount: number };
export type JpegPage = { bytes: Uint8Array; width: number; height: number };

export const SAVE_OPTIONS = { useObjectStreams: true } as const;
const A4 = { width: 595.28, height: 841.89 }; // points (72 DPI)
const IMAGE_MARGIN = 24;

/* ---------------------------------------------------------------- helpers */

export async function loadPdf(bytes: Uint8Array, name = "This PDF"): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    if (error instanceof Error && /encrypted/i.test(error.message)) {
      throw new Error(`"${name}" is password-protected. Unlock it first (the web app opens locked PDFs with the password) and try again.`);
    }
    throw new Error(`Could not open "${name}". It may be damaged or not a supported PDF.`);
  }
}

async function buildFromIndices(source: PDFDocument, indices: number[]): Promise<MergeResult> {
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, indices);
  pages.forEach((page) => output.addPage(page));
  return { bytes: await output.save(SAVE_OPTIONS), pageCount: pages.length };
}

type InputKind = "pdf" | ImageKind;

/** Decide what a file really is from its bytes, falling back to the extension. */
function classify(file: PdfInput): InputKind {
  const image = sniffImageKind(file.bytes);
  if (image) return image;
  if (isPdfName(file.name) || looksLikePdf(file.bytes)) return "pdf";
  if (isImageName(file.name)) return /\.png$/i.test(file.name) ? "png" : "jpeg";
  return "pdf";
}

/* --------------------------------------------------------------- validate */

export function validatePdfInputs(files: PdfInput[]): void {
  if (files.length < 1) throw new Error("Choose at least one PDF or image file.");
  for (const file of files) {
    if (!isSupportedName(file.name)) {
      throw new Error(`"${file.name}" is not supported. Choose PDF, JPG, JPEG, or PNG files.`);
    }
    if (!file.bytes || file.bytes.byteLength === 0) {
      throw new Error(`"${file.name}" is empty or could not be read.`);
    }
  }
}

/* ------------------------------------------------------------------ merge */

/** Counter-clockwise turn (degrees) needed to show stored pixels upright for each EXIF orientation. */
const EXIF_CCW: Record<number, number> = { 3: 180, 4: 180, 5: 270, 6: 270, 7: 90, 8: 90 };

/**
 * Draw an image on its own A4 page (portrait or landscape, whichever fits better),
 * honouring the JPEG EXIF orientation plus any extra clockwise turn requested by the user.
 */
function addImagePage(output: PDFDocument, image: PDFImage, orientation: number, extraClockwise: number): void {
  const angle = (((EXIF_CCW[orientation] ?? 0) - extraClockwise) % 360 + 360) % 360; // CCW, 0|90|180|270
  const swapped = angle % 180 !== 0;
  const shownWidth = swapped ? image.height : image.width;
  const shownHeight = swapped ? image.width : image.height;
  const landscape = shownWidth > shownHeight;
  const pageWidth = landscape ? A4.height : A4.width;
  const pageHeight = landscape ? A4.width : A4.height;

  const scale = Math.min((pageWidth - IMAGE_MARGIN * 2) / shownWidth, (pageHeight - IMAGE_MARGIN * 2) / shownHeight);
  const boxLeft = (pageWidth - shownWidth * scale) / 2;
  const boxBottom = (pageHeight - shownHeight * scale) / 2;
  const width = image.width * scale;
  const height = image.height * scale;

  // pdf-lib rotates around the draw origin, so shift it to keep the image inside its box.
  const origin = {
    0: { x: boxLeft, y: boxBottom },
    90: { x: boxLeft + height, y: boxBottom },
    180: { x: boxLeft + width, y: boxBottom + height },
    270: { x: boxLeft, y: boxBottom + width }
  }[angle as Rotation];

  const page = output.addPage([pageWidth, pageHeight]);
  page.drawImage(image, { ...origin, width, height, rotate: degrees(angle) });
}

/**
 * Combine PDFs and images (JPG/JPEG/PNG) in the exact order supplied.
 * Everything happens in memory — no backend, no upload.
 */
export async function mergePdfBuffers(files: PdfInput[]): Promise<MergeResult> {
  validatePdfInputs(files);
  const output = await PDFDocument.create();
  let totalPages = 0;

  for (const file of files) {
    const kind = classify(file);

    if (kind === "pdf") {
      const source = await loadPdf(file.bytes, file.name);
      const indices = source.getPageIndices();
      if (indices.length === 0) throw new Error(`"${file.name}" does not contain any pages.`);
      const copied = await output.copyPages(source, indices);
      copied.forEach((page) => {
        if (file.rotation) page.setRotation(degrees((page.getRotation().angle + file.rotation) % 360));
        output.addPage(page);
      });
      totalPages += copied.length;
      continue;
    }

    try {
      const image = kind === "png" ? await output.embedPng(file.bytes) : await output.embedJpg(file.bytes);
      addImagePage(output, image, kind === "jpeg" ? readJpegOrientation(file.bytes) : 1, file.rotation ?? 0);
      totalPages += 1;
    } catch {
      throw new Error(`Could not open image "${file.name}". It may be damaged or use an unsupported image format.`);
    }
  }

  return { bytes: await output.save(SAVE_OPTIONS), pageCount: totalPages };
}

/* ------------------------------------------------------- page operations */

export async function getPdfPageCount(bytes: Uint8Array, name?: string): Promise<number> {
  return (await loadPdf(bytes, name)).getPageCount();
}

/** Keep only the selected pages, e.g. "1-3,5". */
export async function extractPdfPages(bytes: Uint8Array, pageRange: string): Promise<MergeResult> {
  const source = await loadPdf(bytes);
  return buildFromIndices(source, parsePageRanges(pageRange, source.getPageCount()));
}

/** One PDF per group. Separate files with ";" and pages with "," — e.g. "1-2;3-5;6" or "1,3;2,4-5". */
export async function splitPdfByRanges(bytes: Uint8Array, ranges: string): Promise<MergeResult[]> {
  const source = await loadPdf(bytes);
  const groups = parseSplitGroups(ranges);
  if (groups.length < 2) {
    throw new Error("Enter at least two page groups. Separate output files with semicolons, e.g. 1-2;3-5;6.");
  }
  const results: MergeResult[] = [];
  for (const group of groups) results.push(await buildFromIndices(source, parsePageRanges(group, source.getPageCount())));
  return results;
}

/** Split into consecutive files of `pagesPerFile` pages each (1 = one file per page). */
export async function splitPdfEvery(bytes: Uint8Array, pagesPerFile: number): Promise<MergeResult[]> {
  if (!Number.isInteger(pagesPerFile) || pagesPerFile < 1) throw new Error("Pages per file must be a whole number of 1 or more.");
  const source = await loadPdf(bytes);
  const total = source.getPageCount();
  if (pagesPerFile >= total) throw new Error(`This PDF has ${total} page${total === 1 ? "" : "s"}, so there is nothing to split at ${pagesPerFile} per file.`);
  const results: MergeResult[] = [];
  for (let start = 0; start < total; start += pagesPerFile) {
    const end = Math.min(start + pagesPerFile, total);
    results.push(await buildFromIndices(source, Array.from({ length: end - start }, (_, i) => start + i)));
  }
  return results;
}

/** Rotate all pages ("all") or a 1-based selection by a multiple of 90 degrees (clockwise). */
export async function rotatePdfPages(bytes: Uint8Array, degreesToAdd: number, pageRange = "all"): Promise<MergeResult> {
  if (!Number.isInteger(degreesToAdd) || degreesToAdd % 90 !== 0) throw new Error("Rotation must be a multiple of 90 degrees.");
  const doc = await loadPdf(bytes);
  for (const index of resolvePages(pageRange, doc.getPageCount())) {
    const page = doc.getPage(index);
    page.setRotation(degrees((((page.getRotation().angle + degreesToAdd) % 360) + 360) % 360));
  }
  return { bytes: await doc.save(SAVE_OPTIONS), pageCount: doc.getPageCount() };
}

/** Re-save with object streams and clear identifying metadata. Structural only — no lossy recompression. */
export async function optimizePdf(bytes: Uint8Array): Promise<MergeResult> {
  const doc = await loadPdf(bytes);
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("GattaiMate");
  doc.setCreator("GattaiMate");
  return { bytes: await doc.save({ ...SAVE_OPTIONS, addDefaultPage: false }), pageCount: doc.getPageCount() };
}

/** Build a PDF from already-rendered JPEG pages (used by the web "smaller file" optimizer). */
export async function pdfFromJpegPages(pages: JpegPage[]): Promise<MergeResult> {
  if (pages.length === 0) throw new Error("There are no pages to write.");
  const output = await PDFDocument.create();
  for (const entry of pages) {
    const image = await output.embedJpg(entry.bytes);
    output.addPage([entry.width, entry.height]).drawImage(image, { x: 0, y: 0, width: entry.width, height: entry.height });
  }
  return { bytes: await output.save(SAVE_OPTIONS), pageCount: pages.length };
}


