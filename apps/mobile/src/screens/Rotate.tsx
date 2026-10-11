import { useState } from "react";
import { baseName, rotatePdfPages, withExtension } from "@gattaimate/pdf-core";
import FileTool from "../FileTool";
import { Field, Segmented } from "../ui";

export default function Rotate() {
  const [angle, setAngle] = useState(90);
  const [scope, setScope] = useState<"all" | "range">("all");
  const [pages, setPages] = useState("");
  return (
    <FileTool id="rotate" kind="pdf" actionLabel="Rotate & share"
      options={({ pageCount }) => (<>
        <Segmented label="Rotate" value={angle} onChange={setAngle} options={[{ value: 90, label: "90° right" }, { value: 180, label: "180°" }, { value: 270, label: "90° left" }]} />
        <Segmented label="Pages" value={scope} onChange={setScope} options={[{ value: "all", label: "All pages" }, { value: "range", label: "Selected" }]} />
        {scope === "range" && <Field label="Pages to rotate" value={pages} onChangeText={setPages} placeholder="1-3,5" hint={pageCount ? `This PDF has ${pageCount} pages.` : undefined} />}
      </>)}
      run={async ({ file, bytes }) => {
        const out = await rotatePdfPages(await bytes(), angle, scope === "all" ? "all" : pages);
        return { name: withExtension(`${baseName(file.name)}-rotated`, ".pdf"), mime: "application/pdf", bytes: out.bytes, pages: out.pageCount, message: `Rotated ${scope === "all" ? "all pages" : "the selected pages"}.` };
      }} />
  );
}
