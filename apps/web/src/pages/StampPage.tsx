import { useState } from "react";
import { addPageNumbers, addWatermark, baseName, withExtension, type NumberPosition } from "@gattaimate/pdf-core";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBytes } from "../lib/browser";

const POSITIONS: { value: NumberPosition; label: string }[] = [
  { value: "bottom-center", label: "Bottom center" }, { value: "bottom-right", label: "Bottom right" }, { value: "bottom-left", label: "Bottom left" },
  { value: "top-center", label: "Top center" }, { value: "top-right", label: "Top right" }, { value: "top-left", label: "Top left" }
];
const FORMATS = [{ value: "{n}", label: "1, 2, 3" }, { value: "Page {n} of {total}", label: "Page 1 of 10" }, { value: "- {n} -", label: "- 1 -" }];

export default function StampPage() {
  const [numbers, setNumbers] = useState(true);
  const [position, setPosition] = useState<NumberPosition>("bottom-center");
  const [format, setFormat] = useState(FORMATS[1].value);
  const [startAt, setStartAt] = useState(1);
  const [pages, setPages] = useState("");
  const [watermark, setWatermark] = useState(false);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(18);

  return (
    <SingleFileTool
      id="stamp"
      accept="pdf"
      actionLabel="Apply & download"
      options={({ pageCount }) => (
        <>
          <label className="check"><input type="checkbox" checked={numbers} onChange={(e) => setNumbers(e.target.checked)} /> Add page numbers</label>
          {numbers && (
            <div className="subgrid">
              <div className="field"><label htmlFor="num-pos">Position</label>
                <select id="num-pos" value={position} onChange={(e) => setPosition(e.target.value as NumberPosition)}>{POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
              <div className="field"><label htmlFor="num-format">Style</label>
                <select id="num-format" value={format} onChange={(e) => setFormat(e.target.value)}>{FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
              <div className="field"><label htmlFor="num-start">Start at</label>
                <input id="num-start" type="number" min={0} value={startAt} onChange={(e) => setStartAt(Math.max(0, Math.floor(Number(e.target.value) || 0)))} /></div>
              <div className="field"><label htmlFor="num-pages">Pages (blank = all)</label>
                <input id="num-pages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={pageCount ? `2-${pageCount}` : "2-10"} autoComplete="off" /></div>
            </div>
          )}
          <label className="check"><input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} /> Add a diagonal text watermark</label>
          {watermark && (
            <div className="subgrid">
              <div className="field"><label htmlFor="wm-text">Text</label><input id="wm-text" value={text} maxLength={40} onChange={(e) => setText(e.target.value)} autoComplete="off" /></div>
              <div className="field"><label htmlFor="wm-opacity">Opacity · {opacity}%</label><input id="wm-opacity" type="range" min={5} max={60} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /></div>
            </div>
          )}
          <small className="hint">Uses a built-in font, so use Latin letters, numbers and common punctuation.</small>
        </>
      )}
      run={async ({ file, bytes }) => {
        if (!numbers && !watermark) throw new Error("Turn on page numbers or a watermark first.");
        let data = await bytes();
        let pageCount = 0;
        if (numbers) { const out = await addPageNumbers(data, { position, format, startAt, pages }); data = out.bytes; pageCount = out.pageCount; }
        if (watermark) { const out = await addWatermark(data, { text, opacity: opacity / 100 }); data = out.bytes; pageCount = out.pageCount; }
        const name = withExtension(`${baseName(file.name)}-stamped`, ".pdf");
        const size = downloadBytes(data, name);
        return { message: `Saved ${name}${numbers ? " with page numbers" : ""}${watermark ? `${numbers ? " and" : " with"} a “${text}” watermark` : ""}.`, name, size, pages: pageCount };
      }}
    />
  );
}
