import { useState } from "react";
import { baseName, formatBytes, optimizePdf, withExtension } from "@gattaimate/pdf-core";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBytes } from "../lib/browser";

const change = (before: number, after: number) => {
  const delta = Math.round((1 - after / before) * 100);
  if (delta > 0) return `${delta}% smaller`;
  return delta < 0 ? `${Math.abs(delta)}% larger — the original may already be well optimized` : "the same size";
};

export default function OptimizePdfPage() {
  const [mode, setMode] = useState<"keep" | "smaller">("keep");
  const [quality, setQuality] = useState(70);

  return (
    <SingleFileTool
      id="optimize-pdf"
      accept="pdf"
      actionLabel="Optimize & download"
      options={() => (
        <>
          <div className="segmented" role="radiogroup" aria-label="Optimization method">
            <label className={mode === "keep" ? "on" : ""}><input type="radio" checked={mode === "keep"} onChange={() => setMode("keep")} />Keep text &amp; links</label>
            <label className={mode === "smaller" ? "on" : ""}><input type="radio" checked={mode === "smaller"} onChange={() => setMode("smaller")} />Smaller file</label>
          </div>
          {mode === "keep" ? (
            <p className="hint">Rewrites the PDF more efficiently and clears title/author metadata. Text, links and forms are untouched, but files often shrink only a little.</p>
          ) : (
            <div className="field">
              <label htmlFor="pdf-quality">Image quality · {quality}%</label>
              <input id="pdf-quality" type="range" min={35} max={92} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
              <small>Turns every page into a compressed image for the biggest savings. <b>Text will no longer be selectable</b> and links/forms are lost — keep your original if you need them.</small>
            </div>
          )}
        </>
      )}
      run={async ({ file, bytes, progress }) => {
        let output: { bytes: Uint8Array; pageCount: number };
        if (mode === "keep") {
          output = await optimizePdf(await bytes());
        } else {
          const { rasterizePdf } = await import("../lib/rasterize");
          output = await rasterizePdf(file, { quality, onProgress: (done, total) => progress(`Compressing page ${done} of ${total}…`) });
        }
        if (mode === "smaller" && output.bytes.byteLength >= file.size) {
          throw new Error(`Flattening would make this file larger (${formatBytes(file.size)} → ${formatBytes(output.bytes.byteLength)}), so nothing was saved. This mode works best on scanned or photo-heavy PDFs — try “Keep text & links” or lower the quality.`);
        }
        const name = withExtension(`${baseName(file.name)}-optimized`, ".pdf");
        const size = downloadBytes(output.bytes, name);
        return { message: `Saved ${name}: ${formatBytes(file.size)} → ${formatBytes(size)} (${change(file.size, size)}).`, name, size, pages: output.pageCount };
      }}
    />
  );
}
