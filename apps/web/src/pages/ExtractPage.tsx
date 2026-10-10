import { useState } from "react";
import { baseName, extractPdfPages, withExtension } from "@gattaimate/pdf-core";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBytes } from "../lib/browser";

export default function ExtractPage() {
  const [pages, setPages] = useState("");
  return (
    <SingleFileTool
      id="extract"
      accept="pdf"
      actionLabel="Extract & download"
      options={({ pageCount }) => (
        <div className="field">
          <label htmlFor="pages">Pages to keep</label>
          <input id="pages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={pageCount && pageCount > 3 ? "1-3,5" : "1-2"} autoComplete="off" spellCheck={false} />
          <small>Use page numbers and ranges such as <code>1-3,5,8-9</code>{pageCount ? ` (this PDF has ${pageCount} pages)` : ""}. Pages keep their original order.</small>
        </div>
      )}
      run={async ({ file, bytes }) => {
        const result = await extractPdfPages(await bytes(), pages);
        const name = withExtension(`${baseName(file.name)}-pages`, ".pdf");
        const size = downloadBytes(result.bytes, name);
        return { message: `Extracted ${result.pageCount} page${result.pageCount === 1 ? "" : "s"} into ${name}.`, name, size, pages: result.pageCount };
      }}
    />
  );
}
