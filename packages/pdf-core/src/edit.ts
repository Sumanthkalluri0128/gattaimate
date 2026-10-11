import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt-lite";
import { sniffImageKind } from "./images";
import { loadPdf, SAVE_OPTIONS, type MergeResult } from "./pdf";
import { resolvePages } from "./ranges";

const norm = (angle: number) => (((angle % 360) + 360) % 360);

/* ------------------------------------------------------------ geometry */

/** Size of a page as displayed (i.e. after its /Rotate is applied). */
export function displaySize(page: PDFPage): { width: number; height: number } {
  const { width, height } = page.getSize();
  return norm(page.getRotation().angle) % 180 === 0 ? { width, height } : { width: height, height: width };
}

/**
 * Convert a point on the *displayed* page (dx right, dy down from the top-left, in points)
 * to PDF user space, honouring the page's /Rotate. Drawing there with `rotate: degrees(rotation)`
 * makes content appear upright on rotated pages.
 */
export function displayedToUser(page: PDFPage, dx: number, dy: number): { x: number; y: number; rotation: number } {
  const { width: W, height: H } = page.getSize();
  const rotation = norm(page.getRotation().angle);
  switch (rotation) {
    case 90: return { x: dy, y: dx, rotation };
    case 180: return { x: W - dx, y: dy, rotation };
    case 270: return { x: W - dy, y: H - dx, rotation };
    default: return { x: dx, y: H - dy, rotation };
  }
}

async function withFont<T>(doc: PDFDocument, name: StandardFonts, use: (font: PDFFont) => T): Promise<T> {
  const font = await doc.embedFont(name);
  try {
    return use(font);
  } catch (error) {
    if (error instanceof Error && /encode|WinAnsi/i.test(error.message)) {
      throw new Error("That text has characters the built-in font can't print. Use Latin letters, numbers and common punctuation.");
    }
    throw error;
  }
}

/* ------------------------------------------------------------ organize */

export type PagePlan = { page: number; rotation?: number };

/** Build a new PDF from an ordered plan: reorder, delete (omit), duplicate and rotate pages. */
export async function organizePdf(bytes: Uint8Array, plan: PagePlan[]): Promise<MergeResult> {
  if (plan.length === 0) throw new Error("Keep at least one page.");
  const source = await loadPdf(bytes);
  const count = source.getPageCount();
  if (plan.some((entry) => !Number.isInteger(entry.page) || entry.page < 0 || entry.page >= count)) {
    throw new Error("The page plan refers to a page that does not exist.");
  }
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, plan.map((entry) => entry.page));
  pages.forEach((page, index) => {
    const extra = plan[index].rotation ?? 0;
    if (extra) page.setRotation(degrees(norm(page.getRotation().angle + extra)));
    output.addPage(page);
  });
  return { bytes: await output.save(SAVE_OPTIONS), pageCount: pages.length };
}

/* --------------------------------------------------- numbers & watermark */

export type NumberPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
export type PageNumberOptions = {
  position?: NumberPosition;
  /** Use {n} for the page number and {total} for the page count. */
  format?: string;
  startAt?: number;
  fontSize?: number;
  /** Pages to number (e.g. "2-10"); empty = all. */
  pages?: string;
};

export async function addPageNumbers(bytes: Uint8Array, options: PageNumberOptions = {}): Promise<MergeResult> {
  const { position = "bottom-center", format = "{n}", startAt = 1, fontSize = 11, pages = "" } = options;
  const doc = await loadPdf(bytes);
  const targets = new Set(resolvePages(pages, doc.getPageCount()));
  const total = doc.getPageCount();
  const margin = 28;
  await withFont(doc, StandardFonts.Helvetica, (font) => {
    doc.getPages().forEach((page, index) => {
      if (!targets.has(index)) return;
      const text = format.replaceAll("{n}", String(startAt + index)).replaceAll("{total}", String(total + startAt - 1));
      const width = font.widthOfTextAtSize(text, fontSize);
      const view = displaySize(page);
      const dx = position.endsWith("left") ? margin : position.endsWith("right") ? view.width - margin - width : (view.width - width) / 2;
      const dy = position.startsWith("top") ? margin + fontSize : view.height - margin;
      const at = displayedToUser(page, dx, dy);
      page.drawText(text, { x: at.x, y: at.y, size: fontSize, font, color: rgb(0.2, 0.2, 0.25), rotate: degrees(at.rotation) });
    });
  });
  return { bytes: await doc.save(SAVE_OPTIONS), pageCount: total };
}

export type WatermarkOptions = {
  text: string;
  opacity?: number;
  /** Visual angle in degrees, counter-clockwise (default 45). */
  angle?: number;
  fontSize?: number;
  color?: [number, number, number];
  pages?: string;
};

export async function addWatermark(bytes: Uint8Array, options: WatermarkOptions): Promise<MergeResult> {
  const text = options.text.trim();
  if (!text) throw new Error("Enter the watermark text.");
  const { opacity = 0.18, angle = 45, color = [0.85, 0.1, 0.2], pages = "" } = options;
  const doc = await loadPdf(bytes);
  const targets = new Set(resolvePages(pages, doc.getPageCount()));
  await withFont(doc, StandardFonts.HelveticaBold, (font) => {
    const theta = (angle * Math.PI) / 180;
    const unit = font.widthOfTextAtSize(text, 1);
    doc.getPages().forEach((page, index) => {
      if (!targets.has(index)) return;
      const view = displaySize(page);
      const size = options.fontSize ?? Math.min(120, (Math.min(view.width, view.height) * 0.7) / unit / Math.max(Math.cos(theta), 0.5));
      const width = unit * size;
      // Centre the text on the page: start point = centre − half the text vector − half the cap height along the normal.
      const sx = view.width / 2 - (Math.cos(theta) * width) / 2 + Math.sin(theta) * size * 0.35;
      const sy = view.height / 2 - (Math.sin(theta) * width) / 2 - Math.cos(theta) * size * 0.35;
      const at = displayedToUser(page, sx, view.height - sy);
      page.drawText(text, { x: at.x, y: at.y, size, font, color: rgb(...color), opacity, rotate: degrees(angle + at.rotation) });
    });
  });
  return { bytes: await doc.save(SAVE_OPTIONS), pageCount: doc.getPageCount() };
}

/* ------------------------------------------------------------ signature */

export type SignatureOptions = {
  pageIndex: number;
  /** Top-left of the signature as a fraction (0-1) of the displayed page. */
  x: number;
  y: number;
  /** Signature width as a fraction of the displayed page width. */
  width: number;
  /** PNG/JPEG image bytes (drawn or uploaded) ... */
  image?: Uint8Array;
  /** ...or a typed signature rendered in an italic serif font. */
  text?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export async function addSignature(bytes: Uint8Array, options: SignatureOptions): Promise<MergeResult> {
  const doc = await loadPdf(bytes);
  if (!Number.isInteger(options.pageIndex) || options.pageIndex < 0 || options.pageIndex >= doc.getPageCount()) throw new Error("Choose a page that exists in this PDF.");
  const page = doc.getPage(options.pageIndex);
  const view = displaySize(page);
  const boxWidth = clamp(options.width, 0.05, 1) * view.width;

  let boxHeight: number;
  let draw: (at: { x: number; y: number; rotation: number }) => void;

  if (options.image) {
    const kind = sniffImageKind(options.image);
    if (!kind) throw new Error("The signature image must be a PNG or JPG.");
    const image = kind === "png" ? await doc.embedPng(options.image) : await doc.embedJpg(options.image);
    boxHeight = (boxWidth * image.height) / image.width;
    draw = (at) => page.drawImage(image, { x: at.x, y: at.y, width: boxWidth, height: boxHeight, rotate: degrees(at.rotation) });
  } else if (options.text?.trim()) {
    const text = options.text.trim();
    const font = await doc.embedFont(StandardFonts.TimesRomanItalic);
    let size: number;
    try { size = boxWidth / font.widthOfTextAtSize(text, 1); } catch { throw new Error("That text has characters the built-in font can't print. Use Latin letters."); }
    boxHeight = size * 1.1;
    draw = (at) => page.drawText(text, { x: at.x, y: at.y, size, font, color: rgb(0.05, 0.1, 0.45), rotate: degrees(at.rotation) });
  } else {
    throw new Error("Draw, type or upload a signature first.");
  }

  const left = clamp(options.x * view.width, 0, view.width - boxWidth);
  const top = clamp(options.y * view.height, 0, view.height - boxHeight);
  // Bottom-left of the box in displayed coordinates; text baseline sits slightly above it.
  draw(displayedToUser(page, left, top + boxHeight));
  return { bytes: await doc.save(SAVE_OPTIONS), pageCount: doc.getPageCount() };
}

/* --------------------------------------------------------------- redact */

export type PageImage = { pageIndex: number; image: Uint8Array };

/**
 * Replace whole pages with images of themselves (rendered by the caller with the redaction boxes burned in).
 * The original text/graphics on those pages are discarded, so redacted content cannot be recovered.
 */
export async function replacePagesWithImages(bytes: Uint8Array, replacements: PageImage[]): Promise<MergeResult> {
  if (replacements.length === 0) throw new Error("Draw at least one redaction box.");
  const source = await loadPdf(bytes);
  const output = await PDFDocument.create();
  const byPage = new Map(replacements.map((entry) => [entry.pageIndex, entry.image]));
  for (let index = 0; index < source.getPageCount(); index++) {
    const image = byPage.get(index);
    if (!image) {
      const [copy] = await output.copyPages(source, [index]);
      output.addPage(copy);
      continue;
    }
    const view = displaySize(source.getPage(index));
    const kind = sniffImageKind(image);
    const embedded = kind === "png" ? await output.embedPng(image) : await output.embedJpg(image);
    output.addPage([view.width, view.height]).drawImage(embedded, { x: 0, y: 0, width: view.width, height: view.height });
  }
  return { bytes: await output.save(SAVE_OPTIONS), pageCount: output.getPageCount() };
}

/* -------------------------------------------------------------- protect */

/**
 * Require a password to open the PDF. Uses RC4 128-bit, which every PDF reader supports but which
 * is a light deterrent, not strong encryption. Use a dedicated tool for highly sensitive files.
 */
export async function protectPdf(bytes: Uint8Array, password: string, ownerPassword?: string): Promise<Uint8Array> {
  if (password.length < 4) throw new Error("Use a password of at least 4 characters.");
  await loadPdf(bytes); // fail early with a friendly message if it is already protected or damaged
  return encryptPDF(bytes, password, ownerPassword);
}
