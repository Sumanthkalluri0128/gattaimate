import { useCallback, useEffect, useRef, useState } from "react";
import { baseName, replacePagesWithImages, withExtension } from "@gattaimate/pdf-core";
import PageStage from "../components/PageStage";
import PageStepper from "../components/PageStepper";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBytes } from "../lib/browser";
import { burnRedactions, type Box } from "../lib/redact";

type Boxes = Record<number, Box[]>;

function Editor({ file, onBoxes }: { file: File; onBoxes: (boxes: Boxes) => void }) {
  const [boxes, setBoxes] = useState<Boxes>({});
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [draft, setDraft] = useState<Box | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  // A new file must never inherit boxes drawn on the previous one.
  useEffect(() => { onBoxes({}); }, [onBoxes]);

  const commit = (next: Boxes) => { setBoxes(next); onBoxes(next); };
  const rect = (fx: number, fy: number): Box => ({ x: Math.min(start.current!.x, fx), y: Math.min(start.current!.y, fy), w: Math.abs(fx - start.current!.x), h: Math.abs(fy - start.current!.y) });
  const onLoaded = useCallback((count: number) => setPages(count), []);

  const total = Object.values(boxes).reduce((n, list) => n + list.length, 0);
  const here = boxes[page] ?? [];

  return (
    <>
      <div className="viewer-toolbar">
        <PageStepper page={page} count={pages} onChange={setPage} />
        <div className="viewer-group">
          <button className="btn btn-secondary btn-sm" disabled={here.length === 0} onClick={() => commit({ ...boxes, [page]: here.slice(0, -1) })}>Undo box</button>
          <button className="btn btn-secondary btn-sm" disabled={total === 0} onClick={() => commit({})}>Clear all</button>
        </div>
      </div>
      <small className="hint">Drag on the page to draw black boxes over anything sensitive. {total ? `${total} box${total === 1 ? "" : "es"} on ${Object.values(boxes).filter((l) => l.length).length} page(s).` : ""}</small>
      <PageStage file={file} pageIndex={page} onLoaded={onLoaded}
        onPointer={(phase, fx, fy) => {
          if (phase === "down") { start.current = { x: fx, y: fy }; setDraft({ x: fx, y: fy, w: 0, h: 0 }); }
          else if (start.current) {
            const box = rect(fx, fy);
            if (phase === "move") setDraft(box);
            else { setDraft(null); if (box.w > 0.01 && box.h > 0.005) commit({ ...boxes, [page]: [...here, box] }); start.current = null; }
          }
        }}
        overlay={<>{[...here, ...(draft ? [draft] : [])].map((b, i) => <div key={i} className="redact-box" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />)}</>} />
      <div className="notice notice-info">Redacted pages are saved as images, so the covered text is permanently removed and can’t be copied or recovered. Other pages stay untouched.</div>
    </>
  );
}

export default function RedactPage() {
  const boxes = useRef<Boxes>({});
  const setBoxes = useCallback((b: Boxes) => { boxes.current = b; }, []);
  return (
    <SingleFileTool
      id="redact"
      accept="pdf"
      actionLabel="Redact & download"
      options={({ file }) => <Editor key={`${file.name}-${file.size}-${file.lastModified}`} file={file} onBoxes={setBoxes} />}
      run={async ({ file, bytes, progress }) => {
        progress("Rendering redacted pages…");
        const images = await burnRedactions(file, boxes.current);
        const out = await replacePagesWithImages(await bytes(), images);
        const name = withExtension(`${baseName(file.name)}-redacted`, ".pdf");
        const size = downloadBytes(out.bytes, name);
        return { message: `Saved ${name}. ${images.length} page${images.length === 1 ? " was" : "s were"} flattened with the boxes burned in.`, name, size, pages: out.pageCount };
      }}
    />
  );
}
