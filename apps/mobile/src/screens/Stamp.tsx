import { useState } from "react";
import { addPageNumbers, addWatermark, baseName, withExtension, type NumberPosition } from "@gattaimate/pdf-core";
import FileTool from "../FileTool";
import { Field, Segmented, Stepper } from "../ui";

const FORMATS = [{ value: "{n}", label: "1, 2" }, { value: "Page {n} of {total}", label: "Page 1 of N" }, { value: "- {n} -", label: "- 1 -" }];

export default function Stamp() {
  const [numbers, setNumbers] = useState(true);
  const [position, setPosition] = useState<NumberPosition>("bottom-center");
  const [format, setFormat] = useState(FORMATS[1].value);
  const [startAt, setStartAt] = useState(1);
  const [watermark, setWatermark] = useState(false);
  const [text, setText] = useState("CONFIDENTIAL");
  return (
    <FileTool id="stamp" kind="pdf" actionLabel="Apply & share"
      options={() => (<>
        <Segmented label="Page numbers" value={numbers ? "on" : "off"} onChange={(v) => setNumbers(v === "on")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
        {numbers && (<>
          <Segmented label="Position" value={position.split("-")[0]} onChange={(v) => setPosition(`${v}-${position.split("-")[1]}` as NumberPosition)} options={[{ value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }]} />
          <Segmented value={position.split("-")[1]} onChange={(v) => setPosition(`${position.split("-")[0]}-${v}` as NumberPosition)} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
          <Segmented label="Style" value={format} onChange={setFormat} options={FORMATS} />
          <Stepper label="Start at" value={startAt} min={0} max={999} step={1} onChange={setStartAt} />
        </>)}
        <Segmented label="Watermark" value={watermark ? "on" : "off"} onChange={(v) => setWatermark(v === "on")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
        {watermark && <Field label="Watermark text" value={text} onChangeText={setText} maxLength={40} hint="Latin letters, numbers and common punctuation." />}
      </>)}
      run={async ({ file, bytes }) => {
        if (!numbers && !watermark) throw new Error("Turn on page numbers or a watermark first.");
        let data = await bytes(), pages = 0;
        if (numbers) { const out = await addPageNumbers(data, { position, format, startAt }); data = out.bytes; pages = out.pageCount; }
        if (watermark) { const out = await addWatermark(data, { text }); data = out.bytes; pages = out.pageCount; }
        return { name: withExtension(`${baseName(file.name)}-stamped`, ".pdf"), mime: "application/pdf", bytes: data, pages, message: "Stamped copy ready." };
      }} />
  );
}
