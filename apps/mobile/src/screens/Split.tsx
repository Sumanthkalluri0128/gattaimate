import { useState } from "react";
import { baseName, splitPdfByRanges, splitPdfEvery, withExtension, zipFiles } from "@gattaimate/pdf-core";
import FileTool from "../FileTool";
import { Field, Segmented, Stepper } from "../ui";

export default function Split() {
  const [mode, setMode] = useState<"groups" | "every">("groups");
  const [groups, setGroups] = useState("");
  const [every, setEvery] = useState(1);
  return (
    <FileTool id="split" kind="pdf" actionLabel="Split & share ZIP"
      options={({ pageCount }) => (<>
        <Segmented value={mode} onChange={setMode} options={[{ value: "groups", label: "Page groups" }, { value: "every", label: "Every N pages" }]} />
        {mode === "groups"
          ? <Field label="Page groups" value={groups} onChangeText={setGroups} placeholder={pageCount && pageCount > 2 ? `1-2;3-${pageCount}` : "1-2;3-5;6"} hint="Each group becomes a PDF. Separate groups with ; and pages with commas — e.g. 1-2;3-5;6 or 1,3;2,4-5." />
          : <Stepper label="Pages per file" value={every} min={1} max={Math.max(1, (pageCount ?? 2) - 1)} step={1} onChange={setEvery} />}
      </>)}
      run={async ({ file, bytes }) => {
        const data = await bytes();
        const parts = mode === "groups" ? await splitPdfByRanges(data, groups) : await splitPdfEvery(data, every);
        const base = baseName(file.name), pad = String(parts.length).length;
        const zip = zipFiles(parts.map((part, i) => ({ name: withExtension(`${base}-part-${String(i + 1).padStart(pad, "0")}`, ".pdf"), bytes: part.bytes })));
        return { name: withExtension(`${base}-split`, ".zip"), mime: "application/zip", bytes: zip, pages: parts.reduce((n, p) => n + p.pageCount, 0), message: `Created ${parts.length} PDFs in one ZIP.` };
      }} />
  );
}
