import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { baseName, formatBytes, rotatePdfPages, type Rotation } from "@gattaimate/pdf-core";
import { downloadBlob, downloadBytes, errorMessage, isPdfFile, readBytes } from "../lib/browser";
import { decodeImage, drawRotated, rotateImageFile, type DecodedImage } from "../lib/images";
import { loadPdfjs } from "../lib/pdfjs";
import { useRecent } from "../hooks/useRecent";
import Notice, { type NoticeState } from "./Notice";
import { RotateIcon, RotateLeftIcon } from "./icons";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/** Renders a PDF page or an image on a canvas with page navigation, zoom and rotation. Key it by file. */
export default function DocumentViewer({ file }: { file: File }) {
  const isPdf = isPdfFile(file);
  const recent = useRecent();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRender = useRef<RenderTask | null>(null);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [image, setImage] = useState<DecodedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageNo, setPageNo] = useState(1);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const zoom = ZOOM_STEPS[zoomIndex];
  const pageCount = doc?.numPages ?? (image ? 1 : 0);

  // Load the document once per file.
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    (async () => {
      try {
        if (isPdf) {
          const pdfjs = await loadPdfjs();
          const task = pdfjs.getDocument({ data: await readBytes(file) });
          dispose = () => void task.destroy();
          const loaded = await task.promise;
          if (cancelled) return;
          setDoc(loaded);
        } else {
          const decoded = await decodeImage(file);
          dispose = decoded.release;
          if (cancelled) return;
          setImage(decoded);
        }
      } catch (error) {
        if (!cancelled) setNotice({ kind: "error", text: errorMessage(error, "Could not open this file. It may be damaged or password-protected.") });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; dispose?.(); };
  }, [file, isPdf]);

  // Draw the current page. The previous render is cancelled and awaited so two renders never share the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (!doc && !image)) return;
    let cancelled = false;
    (async () => {
      try {
        const previous = activeRender.current;
        if (previous) { previous.cancel(); await previous.promise.catch(() => undefined); }
        if (cancelled) return;
        const density = Math.min(zoom * Math.min(window.devicePixelRatio || 1, 2), 3);

        if (doc) {
          const page = await doc.getPage(Math.min(Math.max(pageNo, 1), doc.numPages));
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 1.25 * density, rotation: (page.rotate + rotation) % 360 });
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Could not create the preview canvas.");
          const task = page.render({ canvas, canvasContext: context, viewport });
          activeRender.current = task;
          await task.promise;
        } else if (image) {
          const { canvas: drawn } = drawRotated(image, rotation, 1200 * density);
          canvas.width = drawn.width;
          canvas.height = drawn.height;
          canvas.getContext("2d")?.drawImage(drawn, 0, 0);
          drawn.width = 0; drawn.height = 0;
        }
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          setNotice({ kind: "error", text: errorMessage(error, "Could not render this page.") });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [doc, image, pageNo, rotation, zoom]);

  const rotate = (delta: 90 | 270) => setRotation((value) => (((value + delta) % 360) as Rotation));

  async function saveRotated() {
    if (!rotation) { setNotice({ kind: "info", text: "Rotate the preview first, then save a copy." }); return; }
    setBusy(true);
    setNotice(null);
    try {
      if (isPdf) {
        const result = await rotatePdfPages(await readBytes(file), rotation, "all");
        const name = `${baseName(file.name)}-rotated.pdf`;
        const size = downloadBytes(result.bytes, name);
        recent.add({ name, tool: "Rotate", pages: result.pageCount, size });
        setNotice({ kind: "success", text: `Saved ${name} (${formatBytes(size)}). The original is unchanged.` });
      } else {
        const output = await rotateImageFile(file, rotation);
        const size = downloadBlob(output.blob, output.name);
        recent.add({ name: output.name, tool: "Rotate", pages: 1, size });
        setNotice({ kind: "success", text: `Saved ${output.name} (${formatBytes(size)}). The original is unchanged.` });
      }
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error, "Could not save the rotated copy.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="viewer">
      <div className="viewer-toolbar">
        {isPdf && (
          <div className="viewer-group" aria-label="Page navigation">
            <button className="btn btn-secondary btn-sm" disabled={pageNo <= 1} onClick={() => setPageNo((n) => n - 1)}>← Prev</button>
            <span className="viewer-status">Page {pageNo} of {pageCount || "…"}</span>
            <button className="btn btn-secondary btn-sm" disabled={!pageCount || pageNo >= pageCount} onClick={() => setPageNo((n) => n + 1)}>Next →</button>
          </div>
        )}
        <div className="viewer-group" aria-label="Zoom">
          <button className="btn btn-secondary btn-sm" aria-label="Zoom out" disabled={zoomIndex === 0} onClick={() => setZoomIndex((i) => i - 1)}>−</button>
          <span className="viewer-status">{Math.round(zoom * 100)}%</span>
          <button className="btn btn-secondary btn-sm" aria-label="Zoom in" disabled={zoomIndex === ZOOM_STEPS.length - 1} onClick={() => setZoomIndex((i) => i + 1)}>+</button>
        </div>
        <div className="viewer-group" aria-label="Rotation">
          <button className="btn btn-secondary btn-sm" aria-label="Rotate left" onClick={() => rotate(270)}><RotateLeftIcon size={16} /></button>
          <button className="btn btn-secondary btn-sm" aria-label="Rotate right" onClick={() => rotate(90)}><RotateIcon size={16} /></button>
          <button className="btn btn-secondary btn-sm" disabled={rotation === 0} onClick={() => setRotation(0)}>Reset</button>
        </div>
      </div>

      <div className="viewer-stage" aria-busy={loading}>
        {loading && <div className="viewer-loading"><span className="spinner" /> Opening…</div>}
        <canvas ref={canvasRef} className="viewer-canvas" style={{ width: `${zoom * 100}%`, display: doc || image ? "block" : "none" }} aria-label={isPdf ? `Page ${pageNo} of ${file.name}` : file.name} />
      </div>

      <div className="viewer-footer">
        <p>Previewing never downloads or changes your file. Rotation is saved only when you choose “Save rotated copy”{isPdf ? " (all pages)" : ""}.</p>
        <button className="btn btn-primary" disabled={busy || rotation === 0 || (!doc && !image)} onClick={() => void saveRotated()}>
          {busy ? <span className="spinner" /> : null}{busy ? "Saving…" : "Save rotated copy"}
        </button>
      </div>
      <Notice notice={notice} />
    </div>
  );
}
