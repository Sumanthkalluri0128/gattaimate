import { useState } from "react";
import { baseName, rotatePdfPages, withExtension } from "@gattaimate/pdf-core";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBytes } from "../lib/browser";

const ANGLES = [{ value: 90, label: "90° right" }, { value: 180, label: "180°" }, { value: 270, label: "90° left" }] as const;

export default function RotatePage() {
  const [angle, setAngle] = useState<number>(90);
  const [scope, setScope] = useState<"all" | "range">("all");
  const [range, setRange] = useState("");

  return (
    <SingleFileTool
      id="rotate"
      accept="pdf"
      actionLabel="Rotate & download"
      options={({ pageCount }) => (
        <>
          <div className="field">
            <label id="angle-label">Rotate</label>
            <div className="segmented" role="radiogroup" aria-labelledby="angle-label">
              {ANGLES.map((item) => (
                <label key={item.value} className={angle === item.value ? "on" : ""}>
                  <input type="radio" checked={angle === item.value} onChange={() => setAngle(item.value)} />{item.label}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label id="scope-label">Pages</label>
            <div className="segmented" role="radiogroup" aria-labelledby="scope-label">
              <label className={scope === "all" ? "on" : ""}><input type="radio" checked={scope === "all"} onChange={() => setScope("all")} />All pages</label>
              <label className={scope === "range" ? "on" : ""}><input type="radio" checked={scope === "range"} onChange={() => setScope("range")} />Selected pages</label>
            </div>
            {scope === "range" && (
              <>
                <input aria-label="Pages to rotate" value={range} onChange={(e) => setRange(e.target.value)} placeholder="1-3,5" autoComplete="off" spellCheck={false} />
                <small>{pageCount ? `This PDF has ${pageCount} pages. ` : ""}Example: <code>2,4-6</code></small>
              </>
            )}
          </div>
        </>
      )}
      run={async ({ file, bytes }) => {
        const result = await rotatePdfPages(await bytes(), angle, scope === "all" ? "all" : range);
        const name = withExtension(`${baseName(file.name)}-rotated`, ".pdf");
        const size = downloadBytes(result.bytes, name);
        return { message: `Rotated ${scope === "all" ? "all pages" : "the selected pages"} and saved ${name}.`, name, size, pages: result.pageCount };
      }}
    />
  );
}
