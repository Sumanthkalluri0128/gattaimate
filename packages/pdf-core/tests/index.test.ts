import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";
import {
  mergePdfBuffers, validatePdfInputs, extractPdfPages, splitPdfByRanges, splitPdfEvery, rotatePdfPages, optimizePdf,
  parsePageRanges, parseSplitGroups, resolvePages, readJpegOrientation, sniffImageKind, getPdfPageCount,
  pdfFromJpegPages, zipFiles, withExtension, sanitizeFileName, formatBytes
} from "../src/index";

/** Minimal structurally-valid JPEG (SOI, optional EXIF orientation, SOF0, EOI). pdf-lib only reads the header. */
function fakeJpeg(width: number, height: number, orientation?: number): Uint8Array {
  const bytes: number[] = [0xff, 0xd8];
  if (orientation) {
    // APP1 "Exif\0\0" + big-endian TIFF with a single IFD0 entry (0x0112 Orientation)
    const tiff = [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0];
    const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    bytes.push(0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload);
  }
  bytes.push(0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1);
  bytes.push(0xff, 0xd9);
  return Uint8Array.from(bytes);
}


async function makePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([300, 400]);
  return doc.save();
}

describe("pdf-core", () => {
  it("requires at least one PDF or image", () => {
    expect(() => validatePdfInputs([])).toThrow("at least one");
  });

  it("merges files in order and reports total page count", async () => {
    const a = await makePdf(2);
    const b = await makePdf(1);
    const result = await mergePdfBuffers([
      { name: "first.pdf", bytes: a },
      { name: "second.pdf", bytes: b }
    ]);
    const merged = await PDFDocument.load(result.bytes);
    expect(result.pageCount).toBe(3);
    expect(merged.getPageCount()).toBe(3);
  });

  it("rejects unsupported file names", () => {
    expect(() => validatePdfInputs([{ name: "notes.txt", bytes: new Uint8Array([1]) }, { name: "b.pdf", bytes: new Uint8Array([1]) }]))
      .toThrow("is not supported");
  });

  it("converts a PNG image into a page and combines it with a PDF", async () => {
    const pdf = await makePdf(1);
    // Valid 1x1 transparent PNG.
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=";
    const pngBytes = Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0));
    const result = await mergePdfBuffers([
      { name: "document.pdf", bytes: pdf },
      { name: "photo.png", bytes: pngBytes }
    ]);
    const merged = await PDFDocument.load(result.bytes);
    expect(result.pageCount).toBe(2);
    expect(merged.getPageCount()).toBe(2);
  });

  it("accepts JPG, JPEG, and PNG extensions during validation", () => {
    expect(() => validatePdfInputs([
      { name: "photo.jpg", bytes: new Uint8Array([1]) },
      { name: "scan.jpeg", bytes: new Uint8Array([1]) },
      { name: "page.png", bytes: new Uint8Array([1]) }
    ])).not.toThrow();
  });

  it("converts a single PNG into a one-page PDF", async () => {
    // Valid 1x1 transparent PNG.
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=";
    const pngBytes = Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0));
    const result = await mergePdfBuffers([{ name: "photo.png", bytes: pngBytes }]);
    const merged = await PDFDocument.load(result.bytes);
    expect(result.pageCount).toBe(1);
    expect(merged.getPageCount()).toBe(1);
  });


  it("parses page ranges in ascending unique order and rejects invalid pages", () => {
    expect(parsePageRanges("3,1-2,2", 4)).toEqual([0, 1, 2]);
    expect(() => parsePageRanges("1-8", 4)).toThrow("outside this document");
  });

  it("extracts selected pages into a new PDF", async () => {
    const result = await extractPdfPages(await makePdf(5), "2-3,5");
    expect(result.pageCount).toBe(3);
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(3);
  });

  it("splits a PDF into separate page groups", async () => {
    const results = await splitPdfByRanges(await makePdf(5), "1-2;3-5");
    expect(results.map((item) => item.pageCount)).toEqual([2, 3]);
  });

  it("allows multiple non-contiguous pages within a split output group", async () => {
    const results = await splitPdfByRanges(await makePdf(5), "1,3;2,4-5");
    expect(results.map((item) => item.pageCount)).toEqual([2, 3]);
  });

  it("rotates selected pages without changing page count", async () => {
    const result = await rotatePdfPages(await makePdf(3), 90, "2");
    const doc = await PDFDocument.load(result.bytes);
    expect(result.pageCount).toBe(3);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
    expect(doc.getPage(0).getRotation().angle).toBe(0);
  });

  it("re-saves PDFs with structural optimization and keeps pages", async () => {
    const result = await optimizePdf(await makePdf(2));
    expect(result.pageCount).toBe(2);
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(2);
  });

  it("reads EXIF orientation and defaults to 1", () => {
    expect(readJpegOrientation(fakeJpeg(40, 20, 6))).toBe(6);
    expect(readJpegOrientation(fakeJpeg(40, 20, 3))).toBe(3);
    expect(readJpegOrientation(fakeJpeg(40, 20))).toBe(1);
    expect(readJpegOrientation(new Uint8Array([1, 2, 3]))).toBe(1);
  });

  it("sniffs images by content rather than extension", async () => {
    expect(sniffImageKind(fakeJpeg(10, 10))).toBe("jpeg");
    expect(sniffImageKind(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(sniffImageKind(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0]))).toBeNull();
    // A JPEG saved with a .png name must still convert.
    const result = await mergePdfBuffers([{ name: "wrong-extension.png", bytes: fakeJpeg(30, 20) }]);
    expect(result.pageCount).toBe(1);
  });

  it("turns a single JPEG into a one-page PDF (landscape photo gets a landscape A4 page)", async () => {
    const result = await mergePdfBuffers([{ name: "photo.jpg", bytes: fakeJpeg(400, 200) }]);
    const page = (await PDFDocument.load(result.bytes)).getPage(0);
    expect(result.pageCount).toBe(1);
    expect(page.getWidth()).toBeGreaterThan(page.getHeight());
  });

  it("uses the EXIF orientation to pick an upright page for phone photos", async () => {
    // Stored 400x200 but flagged "rotate 90 CW" → displayed 200x400 → portrait.
    const result = await mergePdfBuffers([{ name: "phone.jpg", bytes: fakeJpeg(400, 200, 6) }]);
    const page = (await PDFDocument.load(result.bytes)).getPage(0);
    expect(page.getHeight()).toBeGreaterThan(page.getWidth());
  });

  it("applies a per-file rotation to PDFs and images while merging", async () => {
    const merged = await mergePdfBuffers([
      { name: "a.pdf", bytes: await makePdf(2), rotation: 90 },
      { name: "b.pdf", bytes: await makePdf(1) },
      // Landscape 400x200 photo turned 90° clockwise → portrait page.
      { name: "c.jpg", bytes: fakeJpeg(400, 200), rotation: 90 }
    ]);
    const doc = await PDFDocument.load(merged.bytes);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
    expect(doc.getPage(2).getRotation().angle).toBe(0);
    expect(doc.getPage(3).getHeight()).toBeGreaterThan(doc.getPage(3).getWidth());
  });

  it("gives a friendly error for damaged PDFs", async () => {
    await expect(mergePdfBuffers([{ name: "broken.pdf", bytes: new Uint8Array([1, 2, 3, 4]) }])).rejects.toThrow("Could not open");
  });

  it("parses split groups with semicolons, new lines, and legacy commas", () => {
    expect(parseSplitGroups("1-2; 3-5;6")).toEqual(["1-2", "3-5", "6"]);
    expect(parseSplitGroups("1-2\n3-4")).toEqual(["1-2", "3-4"]);
    expect(parseSplitGroups("1-2,3-5")).toEqual(["1-2", "3-5"]);
    expect(parseSplitGroups("1,3;2,4")).toEqual(["1,3", "2,4"]);
  });

  it("accepts typographic dashes and resolves 'all'", () => {
    expect(parsePageRanges("1\u20133", 5)).toEqual([0, 1, 2]);
    expect(resolvePages("all", 3)).toEqual([0, 1, 2]);
    expect(resolvePages("", 2)).toEqual([0, 1]);
  });

  it("splits every N pages", async () => {
    const pdf = await makePdf(5);
    expect((await splitPdfEvery(pdf, 2)).map((r) => r.pageCount)).toEqual([2, 2, 1]);
    expect((await splitPdfEvery(pdf, 1)).length).toBe(5);
    await expect(splitPdfEvery(pdf, 5)).rejects.toThrow("nothing to split");
    await expect(splitPdfEvery(pdf, 0)).rejects.toThrow("whole number");
  });

  it("rotates cumulatively and supports negative angles", async () => {
    const once = await rotatePdfPages(await makePdf(1), 270);
    const twice = await rotatePdfPages(once.bytes, 180);
    expect((await PDFDocument.load(twice.bytes)).getPage(0).getRotation().angle).toBe(90);
    const back = await rotatePdfPages(await makePdf(1), -90);
    expect((await PDFDocument.load(back.bytes)).getPage(0).getRotation().angle).toBe(270);
    await expect(rotatePdfPages(await makePdf(1), 45)).rejects.toThrow("multiple of 90");
  });

  it("counts pages and rebuilds a PDF from JPEG pages", async () => {
    expect(await getPdfPageCount(await makePdf(4))).toBe(4);
    const rebuilt = await pdfFromJpegPages([{ bytes: fakeJpeg(50, 80), width: 50, height: 80 }, { bytes: fakeJpeg(50, 80), width: 50, height: 80 }]);
    expect(rebuilt.pageCount).toBe(2);
    await expect(pdfFromJpegPages([])).rejects.toThrow("no pages");
  });

  it("zips files and de-duplicates names", () => {
    const zip = zipFiles([
      { name: "a.pdf", bytes: new Uint8Array([1]) },
      { name: "a.pdf", bytes: new Uint8Array([2]) }
    ]);
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(["a (2).pdf", "a.pdf"]);
  });

  it("builds safe file names", () => {
    expect(withExtension("my:report?.pdf", ".pdf")).toBe("my_report_.pdf");
    expect(withExtension("   ", ".pdf", "fallback")).toBe("fallback.pdf");
    expect(sanitizeFileName("..hidden..")).toBe("hidden");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });

});
