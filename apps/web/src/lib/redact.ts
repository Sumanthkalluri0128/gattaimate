import type { PageImage } from "@gattaimate/pdf-core";
import { canvasToBlob } from "./images";
import { loadPdfjs } from "./pdfjs";
import { readBytes } from "./browser";

/** A rectangle as fractions (0-1) of the displayed page. */
export type Box = { x: number; y: number; w: number; h: number };

/** Render each page that has redaction boxes with the boxes painted solid black, ready to replace the page. */
export async function burnRedactions(file: File, boxesByPage: Record<number, Box[]>): Promise<PageImage[]> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: await readBytes(file) });
  const doc = await task.promise;
  try {
    const out: PageImage[] = [];
    for (const [key, boxes] of Object.entries(boxesByPage)) {
      if (boxes.length === 0) continue;
      const index = Number(key);
      const page = await doc.getPage(index + 1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2.5, 4000 / Math.max(base.width, base.height)) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Your browser could not create an image canvas.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      context.fillStyle = "#000";
      for (const box of boxes) context.fillRect(box.x * canvas.width, box.y * canvas.height, box.w * canvas.width, box.h * canvas.height);
      out.push({ pageIndex: index, image: await readBytes(await canvasToBlob(canvas, "image/jpeg", 0.92)) });
      canvas.width = 0; canvas.height = 0;
      page.cleanup();
    }
    return out;
  } finally {
    await task.destroy();
  }
}
