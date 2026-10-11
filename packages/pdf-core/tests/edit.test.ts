import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import {
  addPageNumbers, addSignature, addWatermark, BUILT_IN_PRESETS, describeStep, displayedToUser, displaySize, fillForm, getPdfPageCount,
  listFormFields, organizePdf, protectPdf, replacePagesWithImages, runPipeline, extractPdfPages
} from "../src/index";

const PNG_1X1 = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

async function makePdf(pages: number, size: [number, number] = [200, 100]) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage(size);
  return doc.save();
}

describe("organize", () => {
  it("reorders, deletes, duplicates and rotates", async () => {
    const doc = await PDFDocument.create();
    [[100, 100], [200, 100], [300, 100]].forEach((s) => doc.addPage(s as [number, number]));
    const out = await organizePdf(await doc.save(), [{ page: 2 }, { page: 0, rotation: 90 }, { page: 0 }]);
    const result = await PDFDocument.load(out.bytes);
    expect(out.pageCount).toBe(3);
    expect(result.getPage(0).getWidth()).toBe(300);
    expect(result.getPage(1).getRotation().angle).toBe(90);
    expect(result.getPage(2).getRotation().angle).toBe(0);
  });
  it("validates the plan", async () => {
    const pdf = await makePdf(2);
    await expect(organizePdf(pdf, [])).rejects.toThrow("at least one");
    await expect(organizePdf(pdf, [{ page: 5 }])).rejects.toThrow("does not exist");
  });
});

describe("geometry", () => {
  it("maps displayed points to user space for every page rotation", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 100]);
    // bottom-left of the displayed page must map to a corner and keep the right-hand side consistent
    expect(displayedToUser(page, 0, 100)).toEqual({ x: 0, y: 0, rotation: 0 });
    page.setRotation(degrees(90));
    expect(displaySize(page)).toEqual({ width: 100, height: 200 });
    expect(displayedToUser(page, 0, 200)).toMatchObject({ x: 200, y: 0 }); // displayed bottom-left → user bottom-right
    page.setRotation(degrees(180));
    expect(displayedToUser(page, 0, 100)).toMatchObject({ x: 200, y: 100 });
    page.setRotation(degrees(270));
    expect(displayedToUser(page, 0, 200)).toMatchObject({ x: 0, y: 100 });
  });
});

describe("stamping", () => {
  it("adds page numbers and watermarks without changing page count", async () => {
    const pdf = await makePdf(3);
    const numbered = await addPageNumbers(pdf, { format: "Page {n} of {total}", position: "top-right" });
    const marked = await addWatermark(numbered.bytes, { text: "DRAFT" });
    expect(await getPdfPageCount(marked.bytes)).toBe(3);
    expect(marked.bytes.length).toBeGreaterThan(pdf.length);
  });
  it("limits stamping to a page range and rejects bad text", async () => {
    const pdf = await makePdf(3);
    await expect(addPageNumbers(pdf, { pages: "9" })).rejects.toThrow("outside");
    await expect(addWatermark(pdf, { text: "  " })).rejects.toThrow("Enter the watermark");
    await expect(addWatermark(pdf, { text: "机密" })).rejects.toThrow("characters");
  });
});

describe("signature", () => {
  it("places image and typed signatures, including on rotated pages", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 200]).setRotation(degrees(90));
    const pdf = await doc.save();
    const a = await addSignature(pdf, { pageIndex: 0, x: 0.1, y: 0.1, width: 0.3, image: PNG_1X1 });
    const b = await addSignature(a.bytes, { pageIndex: 0, x: 0.5, y: 0.8, width: 0.4, text: "Jane Doe" });
    expect(await getPdfPageCount(b.bytes)).toBe(1);
  });
  it("validates input", async () => {
    const pdf = await makePdf(1);
    await expect(addSignature(pdf, { pageIndex: 3, x: 0, y: 0, width: 0.2, text: "x" })).rejects.toThrow("page that exists");
    await expect(addSignature(pdf, { pageIndex: 0, x: 0, y: 0, width: 0.2 })).rejects.toThrow("Draw, type");
    await expect(addSignature(pdf, { pageIndex: 0, x: 0, y: 0, width: 0.2, image: new Uint8Array([1, 2, 3]) })).rejects.toThrow("PNG or JPG");
  });
});

describe("redaction", () => {
  it("replaces chosen pages with images", async () => {
    const out = await replacePagesWithImages(await makePdf(3), [{ pageIndex: 1, image: PNG_1X1 }]);
    expect(out.pageCount).toBe(3);
    await expect(replacePagesWithImages(await makePdf(1), [])).rejects.toThrow("at least one");
  });
});

describe("forms", () => {
  async function formPdf() {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const form = doc.getForm();
    form.createTextField("name").addToPage(page, { x: 20, y: 250, width: 200, height: 20 });
    form.createCheckBox("agree").addToPage(page, { x: 20, y: 220, width: 15, height: 15 });
    const dd = form.createDropdown("country"); dd.addOptions(["UK", "IN", "US"]); dd.addToPage(page, { x: 20, y: 190, width: 100, height: 20 });
    const radio = form.createRadioGroup("size"); radio.addOptionToPage("S", page, { x: 20, y: 160, width: 15, height: 15 }); radio.addOptionToPage("L", page, { x: 60, y: 160, width: 15, height: 15 });
    return doc.save();
  }
  it("lists, fills and flattens", async () => {
    const pdf = await formPdf();
    const fields = await listFormFields(pdf);
    expect(fields.map((f) => `${f.name}:${f.type}`).sort()).toEqual(["agree:checkbox", "country:dropdown", "name:text", "size:radio"]);
    const filled = await fillForm(pdf, { name: "Asha", agree: true, country: "IN", size: "L" });
    const values = Object.fromEntries((await listFormFields(filled.bytes)).map((f) => [f.name, f.value]));
    expect(values).toEqual({ name: "Asha", agree: true, country: "IN", size: "L" });
    const flat = await fillForm(filled.bytes, {}, true);
    expect(await listFormFields(flat.bytes)).toEqual([]);
  });
  it("reports a bad option clearly and returns [] for non-forms", async () => {
    await expect(fillForm(await formPdf(), { country: "FR" })).rejects.toThrow("Could not fill");
    expect(await listFormFields(await makePdf(1))).toEqual([]);
  });
});

describe("protect", () => {
  it("encrypts so the file can no longer be opened without a password", async () => {
    const locked = await protectPdf(await makePdf(2), "secret1");
    expect(new TextDecoder("latin1").decode(locked)).toContain("/Encrypt");
    await expect(getPdfPageCount(locked)).rejects.toThrow("password-protected");
    await expect(protectPdf(await makePdf(1), "ab")).rejects.toThrow("at least 4");
  });
});

describe("pipeline", () => {
  it("runs built-in presets, noting steps the platform can't do", async () => {
    const pdf = await makePdf(3);
    for (const preset of BUILT_IN_PRESETS) {
      const result = await runPipeline(pdf, preset.steps);
      expect(result.pageCount).toBe(3);
      if (preset.id === "email") expect(result.notes[0]).toContain("web app");
    }
  });
  it("uses the shrink hook and runs protection last", async () => {
    let shrunk = 0;
    const result = await runPipeline(await makePdf(2), [{ op: "protect", password: "pass1234" }, { op: "shrink", quality: 50 }, { op: "numbers" }], { shrink: async (bytes) => { shrunk++; return bytes; } });
    expect(shrunk).toBe(1);
    expect(result.pageCount).toBe(2);
    expect(new TextDecoder("latin1").decode(result.bytes)).toContain("/Encrypt");
  });
  it("extract/rotate steps work and descriptions exist", async () => {
    const steps = [{ op: "extract", pages: "1" }, { op: "rotate", angle: 90 }] as const;
    const result = await runPipeline(await makePdf(3), [...steps]);
    expect(result.pageCount).toBe(1);
    expect(steps.map(describeStep)).toEqual(["Keep pages 1", "Rotate 90°"]);
    await expect(runPipeline(await makePdf(1), [])).rejects.toThrow("no steps");
    expect((await extractPdfPages(result.bytes, "1")).pageCount).toBe(1);
  });
});
