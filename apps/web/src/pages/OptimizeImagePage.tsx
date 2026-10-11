import { useState } from "react";
import { formatBytes } from "@gattaimate/pdf-core";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBlob } from "../lib/browser";
import { optimizeImage } from "../lib/images";

const SIZES = [{ label: "Keep original size", value: 0 }, { label: "Up to 2400 px", value: 2400 }, { label: "Up to 1600 px", value: 1600 }, { label: "Up to 1200 px", value: 1200 }];

export default function OptimizeImagePage() {
  const [quality, setQuality] = useState(78);
  const [maxSide, setMaxSide] = useState(2400);

  return (
    <SingleFileTool
      id="optimize-image"
      accept="image"
      actionLabel="Optimize & download"
      options={() => (
        <>
          <div className="field">
            <label htmlFor="image-quality">JPEG quality · {quality}%</label>
            <input id="image-quality" type="range" min={35} max={95} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="image-size">Maximum size (longest side)</label>
            <select id="image-size" value={maxSide} onChange={(e) => setMaxSide(Number(e.target.value))}>
              {SIZES.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}
            </select>
            <small>Saved as a JPG. PNG transparency becomes a white background. Smaller images are never enlarged.</small>
          </div>
        </>
      )}
      run={async ({ file }) => {
        const result = await optimizeImage(file, quality, maxSide || null);
        const size = downloadBlob(result.blob, result.name);
        const delta = Math.round((1 - size / file.size) * 100);
        const verdict = delta > 0 ? `${delta}% smaller` : "not smaller — try a lower quality or size";
        return { message: `Saved ${result.name} (${result.width}×${result.height}): ${formatBytes(file.size)} → ${formatBytes(size)}, ${verdict}.`, name: result.name, size, pages: 1, before: file.size };
      }}
    />
  );
}
