import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergePdfBuffers, validatePdfInputs } from "../src/index";

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

});
