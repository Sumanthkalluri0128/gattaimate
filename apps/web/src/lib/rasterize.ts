import { pdfFromJpegPages, type JpegPage, type MergeResult } from "@gattaimate/pdf-core";
import { canvasToBlob } from "./images";
import { loadPdfjs } from "./pdfjs";
import { readBytes } from "./browser";

const MAX_CANVAS_SIDE = 4096;

/**
 * Re-render every page as a JPEG and rebuild the PDF. Page sizes are preserved
 * (the rendering density only affects sharpness), but text and links become pixels.
 */
export async function rasterizePdf(
  file: File,
  options: { quality: number; density?: number; onProgress?: (done: number, total: number) => void }
): Promise<MergeResult> {
  const { quality, density = 1.5, onProgress } = options;
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: await readBytes(file) });
  const source = await task.promise;
  try {
    const pages: JpegPage[] = [];
    for (let number = 1; number <= source.numPages; number++) {
      const page = await source.getPage(number);
      const size = page.getViewport({ scale: 1 });
      const scale = Math.min(density, MAX_CANVAS_SIDE / Math.max(size.width, size.height));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Your browser could not create an image canvas for PDF optimization.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;

      const jpeg = await canvasToBlob(canvas, "image/jpeg", quality / 100);
      pages.push({ bytes: await readBytes(jpeg), width: size.width, height: size.height });
      canvas.width = 0; canvas.height = 0;
      page.cleanup();
      onProgress?.(number, source.numPages);
    }
    return await pdfFromJpegPages(pages);
  } finally {
    await task.destroy();
  }
}
