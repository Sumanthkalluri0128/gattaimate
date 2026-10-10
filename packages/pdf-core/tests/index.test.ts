import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergePdfBuffers, validatePdfInputs } from "../src/index";

async function makePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([300, 400]);
  return doc.save();
}

describe("pdf-core", () => {
  it("requires at least two PDFs", () => {
    expect(() => validatePdfInputs([{ name: "a.pdf", bytes: new Uint8Array([1]) }]))
      .toThrow("at least two");
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

  it("rejects non-PDF file names", () => {
    expect(() => validatePdfInputs([{ name: "notes.txt", bytes: new Uint8Array([1]) }, { name: "b.pdf", bytes: new Uint8Array([1]) }]))
      .toThrow("does not look like a PDF");
  });
});
