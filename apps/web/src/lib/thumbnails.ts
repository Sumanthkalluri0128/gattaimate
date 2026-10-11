import { useEffect, useState } from "react";
import { canvasToBlob } from "./images";
import { usePdfDocument } from "./usePdfDocument";

/** Progressively render small page thumbnails (0-based page index → object URL). */
export function usePdfThumbnails(file: File, width = 150): { thumbs: Map<number, string>; error: string } {
  const { doc, error } = usePdfDocument(file);
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    const urls: string[] = [];
    setThumbs(new Map());
    (async () => {
      for (let number = 1; number <= doc.numPages && !cancelled; number++) {
        try {
          const page = await doc.getPage(number);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width * Math.min(window.devicePixelRatio || 1, 2)) / base.width });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) return;
          context.fillStyle = "#fff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          const blob = await canvasToBlob(canvas, "image/jpeg", 0.7);
          canvas.width = 0; canvas.height = 0;
          page.cleanup();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setThumbs((previous) => new Map(previous).set(number - 1, url));
        } catch { /* leave this thumbnail blank */ }
      }
    })();
    return () => { cancelled = true; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [doc, width]);

  return { thumbs, error };
}
