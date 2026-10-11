import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addSignature, baseName, withExtension, type SignatureOptions } from "@gattaimate/pdf-core";
import PageStage from "../components/PageStage";
import PageStepper from "../components/PageStepper";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBytes, readBytes } from "../lib/browser";
import { canvasToBlob } from "../lib/images";

type Tab = "draw" | "type" | "upload";
type Spec = Pick<SignatureOptions, "pageIndex" | "x" | "y" | "width" | "image" | "text">;

/** Crop transparent margins so the width setting maps to the visible ink. */
async function trimmedPng(source: HTMLCanvasElement): Promise<Uint8Array | null> {
  const context = source.getContext("2d")!;
  const { data, width, height } = context.getImageData(0, 0, source.width, source.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 8) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  if (maxX < 0) return null;
  const pad = 6;
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1 + pad * 2;
  out.height = maxY - minY + 1 + pad * 2;
  out.getContext("2d")!.drawImage(source, minX, minY, maxX - minX + 1, maxY - minY + 1, pad, pad, maxX - minX + 1, maxY - minY + 1);
  return readBytes(await canvasToBlob(out, "image/png"));
}

function Pad({ onInk }: { onInk: (png: Uint8Array | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const point = (event: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return [((event.clientX - rect.left) / rect.width) * ref.current!.width, ((event.clientY - rect.top) / rect.height) * ref.current!.height] as const;
  };
  const context = () => { const c = ref.current!.getContext("2d")!; c.lineWidth = 5; c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#0d1a73"; return c; };
  return (
    <div className="pad">
      <canvas ref={ref} width={900} height={260} aria-label="Draw your signature here"
        onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); const c = context(); const [x, y] = point(e); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 0.1, y + 0.1); c.stroke(); }}
        onPointerMove={(e) => { if (!drawing.current) return; const c = context(); const [x, y] = point(e); c.lineTo(x, y); c.stroke(); }}
        onPointerUp={() => { drawing.current = false; void trimmedPng(ref.current!).then(onInk); }} />
      <button className="btn btn-ghost btn-sm" onClick={() => { ref.current!.getContext("2d")!.clearRect(0, 0, 900, 260); onInk(null); }}>Clear</button>
    </div>
  );
}

function Editor({ file, onSpec }: { file: File; onSpec: (spec: Spec | null) => void }) {
  const [tab, setTab] = useState<Tab>("draw");
  const [ink, setInk] = useState<Uint8Array | null>(null);
  const [upload, setUpload] = useState<Uint8Array | null>(null);
  const [text, setText] = useState("");
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [pos, setPos] = useState({ x: 0.55, y: 0.8 });
  const [width, setWidth] = useState(0.28);
  const [aspect, setAspect] = useState(3);

  const image = tab === "draw" ? ink : tab === "upload" ? upload : null;
  const typed = tab === "type" ? text.trim() : "";
  const previewUrl = useMemo(() => (image ? URL.createObjectURL(new Blob([image as BlobPart])) : ""), [image]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    if (!previewUrl) return;
    const img = new Image();
    img.onload = () => setAspect(img.naturalWidth / img.naturalHeight);
    img.src = previewUrl;
  }, [previewUrl]);
  useEffect(() => { if (typed) setAspect(Math.max(1.5, typed.length * 0.42)); }, [typed]);

  useEffect(() => { onSpec(image || typed ? { pageIndex: page, x: pos.x, y: pos.y, width, image: image ?? undefined, text: typed || undefined } : null); });

  const onLoaded = useCallback((count: number) => setPages(count), []);
  const hasSignature = !!(image || typed);

  return (
    <>
      <div className="segmented" role="tablist" aria-label="Signature type">
        {(["draw", "type", "upload"] as const).map((t) => (
          <label key={t} className={tab === t ? "on" : ""}><input type="radio" checked={tab === t} onChange={() => setTab(t)} />{t === "draw" ? "Draw" : t === "type" ? "Type" : "Upload image"}</label>
        ))}
      </div>
      {tab === "draw" && <Pad onInk={setInk} />}
      {tab === "type" && <div className="field"><label htmlFor="sig-text">Your name</label><input id="sig-text" value={text} maxLength={40} onChange={(e) => setText(e.target.value)} placeholder="Jane Doe" autoComplete="off" /><small>Rendered in an italic script-style font. Latin letters only.</small></div>}
      {tab === "upload" && (
        <div className="field"><label htmlFor="sig-file">Signature image (PNG with transparent background works best)</label>
          <input id="sig-file" type="file" accept="image/png,image/jpeg" onChange={async (e) => { const f = e.target.files?.[0]; setUpload(f ? await readBytes(f) : null); }} /></div>
      )}
      <div className="field"><label htmlFor="sig-width">Size · {Math.round(width * 100)}% of page width</label><input id="sig-width" type="range" min={8} max={60} value={Math.round(width * 100)} onChange={(e) => setWidth(Number(e.target.value) / 100)} /></div>
      <div className="viewer-toolbar"><PageStepper page={page} count={pages} onChange={setPage} /></div>
      <small className="hint">{hasSignature ? "Click or drag on the page to place your signature." : "Create a signature above, then click the page to place it."}</small>
      <PageStage file={file} pageIndex={page} onLoaded={onLoaded}
        onPointer={(phase, fx, fy) => { if (phase !== "up") setPos({ x: Math.min(fx, 1 - width), y: Math.min(fy, 0.97) }); }}
        overlay={hasSignature && (
          <div className="sig-box" style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${width * 100}%`, aspectRatio: String(aspect) }}>
            {previewUrl ? <img src={previewUrl} alt="" draggable={false} /> : (
              <svg viewBox={`0 0 ${aspect * 100} 100`} preserveAspectRatio="none"><text x="0" y="78" fontSize="90" fontStyle="italic" fontFamily="'Times New Roman', Times, serif" fill="#0d1a73" textLength={aspect * 100} lengthAdjust="spacingAndGlyphs">{typed}</text></svg>
            )}
          </div>
        )} />
    </>
  );
}

export default function SignPage() {
  const spec = useRef<Spec | null>(null);
  return (
    <SingleFileTool
      id="sign"
      accept="pdf"
      actionLabel="Sign & download"
      options={({ file }) => <Editor key={`${file.name}-${file.size}-${file.lastModified}`} file={file} onSpec={(s) => { spec.current = s; }} />}
      run={async ({ file, bytes }) => {
        if (!spec.current) throw new Error("Draw, type or upload a signature first.");
        const out = await addSignature(await bytes(), spec.current);
        const name = withExtension(`${baseName(file.name)}-signed`, ".pdf");
        const size = downloadBytes(out.bytes, name);
        return { message: `Saved ${name} with your signature on page ${spec.current.pageIndex + 1}. This is a visual signature, not a certificate-based digital signature.`, name, size, pages: out.pageCount };
      }}
    />
  );
}
