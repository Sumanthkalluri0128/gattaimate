import { useState } from "react";
import { baseName, formatBytes, withExtension, zipFiles } from "@gattaimate/pdf-core";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBytes } from "../lib/browser";
import { renderPdfToImages } from "../lib/pdfImages";

const DPIS = [{ value: 72, label: "Screen · 72 dpi" }, { value: 150, label: "Standard · 150 dpi" }, { value: 200, label: "Sharp · 200 dpi" }, { value: 300, label: "Print · 300 dpi" }];

export default function ToImagesPage() {
  const [format, setFormat] = useState<"png" | "jpeg">("jpeg");
  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(88);
  const [pages, setPages] = useState("");

  return (
    <SingleFileTool
      id="to-images"
      accept="pdf"
      actionLabel="Export images"
      options={({ pageCount }) => (
        <>
          <div className="segmented" role="radiogroup" aria-label="Image format">
            <label className={format === "jpeg" ? "on" : ""}><input type="radio" checked={format === "jpeg"} onChange={() => setFormat("jpeg")} />JPG · smaller</label>
            <label className={format === "png" ? "on" : ""}><input type="radio" checked={format === "png"} onChange={() => setFormat("png")} />PNG · lossless</label>
          </div>
          <div className="field"><label htmlFor="dpi">Resolution</label>
            <select id="dpi" value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>{DPIS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
          {format === "jpeg" && <div className="field"><label htmlFor="jq">JPG quality · {quality}%</label><input id="jq" type="range" min={50} max={98} value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></div>}
          <div className="field"><label htmlFor="ipages">Pages (blank = all)</label>
            <input id="ipages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="1-3,5" autoComplete="off" />
            <small>{pageCount ? `This PDF has ${pageCount} pages. ` : ""}Several images are delivered as one ZIP.</small></div>
        </>
      )}
      run={async ({ file, progress }) => {
        const images = await renderPdfToImages(file, { format, dpi, pages, quality, onProgress: (done, total) => progress(`Rendering page ${done} of ${total}…`) });
        if (images.length === 1) {
          const size = downloadBytes(images[0].bytes, images[0].name, format === "png" ? "image/png" : "image/jpeg");
          return { message: `Saved ${images[0].name} (${formatBytes(size)}).`, name: images[0].name, size, pages: 1 };
        }
        const name = withExtension(`${baseName(file.name)}-images`, ".zip");
        const size = downloadBytes(zipFiles(images), name, "application/zip");
        return { message: `Exported ${images.length} images into ${name} (${formatBytes(size)}).`, name, size, pages: images.length };
      }}
    />
  );
}
