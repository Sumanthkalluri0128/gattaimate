import { useState } from "react";
import { baseName, splitPdfByRanges, splitPdfEvery, withExtension, zipFiles } from "@gattaimate/pdf-core";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBytes } from "../lib/browser";

export default function SplitPage() {
  const [mode, setMode] = useState<"groups" | "every">("groups");
  const [groups, setGroups] = useState("");
  const [every, setEvery] = useState(1);

  return (
    <SingleFileTool
      id="split"
      accept="pdf"
      actionLabel="Split & download ZIP"
      options={({ pageCount }) => (
        <>
          <div className="segmented" role="radiogroup" aria-label="Split method">
            <label className={mode === "groups" ? "on" : ""}><input type="radio" checked={mode === "groups"} onChange={() => setMode("groups")} />Custom page groups</label>
            <label className={mode === "every" ? "on" : ""}><input type="radio" checked={mode === "every"} onChange={() => setMode("every")} />Every N pages</label>
          </div>
          {mode === "groups" ? (
            <div className="field">
              <label htmlFor="groups">Page groups</label>
              <input id="groups" value={groups} onChange={(e) => setGroups(e.target.value)} placeholder={pageCount && pageCount > 2 ? `1-2;3-${pageCount}` : "1-2;3-5;6"} autoComplete="off" spellCheck={false} />
              <small>Each group becomes its own PDF. Separate groups with <b>;</b> and pick pages inside a group with commas — e.g. <code>1-2;3-5;6</code> or <code>1,3;2,4-5</code>.</small>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="every">Pages per file</label>
              <input id="every" type="number" inputMode="numeric" min={1} max={pageCount ?? undefined} value={every} onChange={(e) => setEvery(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
              <small>{pageCount ? `A ${pageCount}-page PDF will make ${Math.ceil(pageCount / every)} file${Math.ceil(pageCount / every) === 1 ? "" : "s"}.` : "Use 1 to save every page as its own PDF."}</small>
            </div>
          )}
        </>
      )}
      run={async ({ file, bytes, progress }) => {
        const results = mode === "groups" ? await splitPdfByRanges(await bytes(), groups) : await splitPdfEvery(await bytes(), every);
        progress("Packaging ZIP…");
        const base = baseName(file.name);
        const pad = String(results.length).length;
        const zip = zipFiles(results.map((part, index) => ({
          name: withExtension(`${base}-part-${String(index + 1).padStart(pad, "0")}`, ".pdf"),
          bytes: part.bytes
        })));
        const name = withExtension(`${base}-split`, ".zip");
        const size = downloadBytes(zip, name, "application/zip");
        return { message: `Created ${results.length} PDFs and saved them together as ${name}.`, name, size, pages: results.reduce((sum, part) => sum + part.pageCount, 0) };
      }}
    />
  );
}
