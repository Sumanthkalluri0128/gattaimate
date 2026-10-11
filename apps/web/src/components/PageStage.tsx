import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RenderTask } from "pdfjs-dist";
import { usePdfDocument } from "../lib/usePdfDocument";

type Props = {
  file: File;
  /** 0-based page */
  pageIndex: number;
  /** Receives pointer positions as fractions (0-1) of the displayed page. */
  onPointer?: (phase: "down" | "move" | "up", fx: number, fy: number) => void;
  overlay?: ReactNode;
  onLoaded?: (pageCount: number) => void;
};

/** A single rendered PDF page with an overlay layer for placing or drawing things on it. */
export default function PageStage({ file, pageIndex, onPointer, overlay, onLoaded }: Props) {
  const { doc, error } = usePdfDocument(file);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const active = useRef<RenderTask | null>(null);
  const dragging = useRef(false);
  const [ratio, setRatio] = useState(1.4);

  useEffect(() => { if (doc) onLoaded?.(doc.numPages); }, [doc, onLoaded]);

  useEffect(() => {
    const target = canvas.current;
    if (!doc || !target) return;
    let cancelled = false;
    (async () => {
      try {
        const previous = active.current;
        if (previous) { previous.cancel(); await previous.promise.catch(() => undefined); }
        const page = await doc.getPage(Math.min(Math.max(pageIndex, 0), doc.numPages - 1) + 1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (900 / base.width) * Math.min(window.devicePixelRatio || 1, 2) });
        target.width = Math.ceil(viewport.width);
        target.height = Math.ceil(viewport.height);
        setRatio(viewport.height / viewport.width);
        const context = target.getContext("2d");
        if (!context) return;
        const task = page.render({ canvas: target, canvasContext: context, viewport });
        active.current = task;
        await task.promise;
      } catch { /* cancelled renders are expected */ }
    })();
    return () => { cancelled = true; };
  }, [doc, pageIndex]);

  const fraction = (event: React.PointerEvent) => {
    const rect = layer.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))] as const;
  };

  if (error) return <div className="notice notice-error" role="alert">{error}</div>;
  return (
    <div className="page-stage" style={{ aspectRatio: `1 / ${ratio}` }}>
      {!doc && <div className="viewer-loading"><span className="spinner" /> Opening…</div>}
      <canvas ref={canvas} aria-label={`Page ${pageIndex + 1}`} />
      <div
        ref={layer}
        className={`stage-layer${onPointer ? " interactive" : ""}`}
        onPointerDown={onPointer && ((event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); onPointer("down", ...fraction(event)); })}
        onPointerMove={onPointer && ((event) => { if (dragging.current) onPointer("move", ...fraction(event)); })}
        onPointerUp={onPointer && ((event) => { if (dragging.current) { dragging.current = false; onPointer("up", ...fraction(event)); } })}
      >
        {overlay}
      </div>
    </div>
  );
}
