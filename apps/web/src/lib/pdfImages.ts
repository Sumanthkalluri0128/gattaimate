import { baseName, resolvePages, withExtension, type NamedBytes } from "@gattaimate/pdf-core";
import { canvasToBlob } from "./images";
import { loadPdfjs } from "./pdfjs";
import { readBytes } from "./browser";

const MAX_SIDE = 8000;

/** Render selected pages to JPG/PNG files. `dpi` of 72 = one pixel per PDF point. */
export async function renderPdfToImages(
  file: File,
  options: { format: "png" | "jpeg"; dpi: number; pages: string; quality?: number; onProgress?: (done: number, total: number) => void }
): Promise<NamedBytes[]> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: await readBytes(file) });
  const doc = await task.promise;
  try {
    const indices = resolvePages(options.pages, doc.numPages);
    const base = baseName(file.name);
    const pad = String(doc.numPages).length;
    const files: NamedBytes[] = [];
    for (const [done, index] of indices.entries()) {
      const page = await doc.getPage(index + 1);
      const size = page.getViewport({ scale: 1 });
      const scale = Math.min(options.dpi / 72, MAX_SIDE / Math.max(size.width, size.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Your browser could not create an image canvas.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const blob = await canvasToBlob(canvas, options.format === "png" ? "image/png" : "image/jpeg", (options.quality ?? 90) / 100);
      canvas.width = 0; canvas.height = 0;
      page.cleanup();
      files.push({ name: withExtension(`${base}-page-${String(index + 1).padStart(pad, "0")}`, options.format === "png" ? ".png" : ".jpg"), bytes: await readBytes(blob) });
      options.onProgress?.(done + 1, indices.length);
    }
    return files;
  } finally {
    await task.destroy();
  }
}

