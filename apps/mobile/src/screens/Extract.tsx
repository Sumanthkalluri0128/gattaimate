import { useState } from "react";
import { baseName, extractPdfPages, withExtension } from "@gattaimate/pdf-core";
import FileTool from "../FileTool";
import { Field } from "../ui";

export default function Extract() {
  const [pages, setPages] = useState("");
  return (
    <FileTool id="extract" kind="pdf" actionLabel="Extract & share"
      options={({ pageCount }) => <Field label="Pages to keep" value={pages} onChangeText={setPages} placeholder="1-3,5" hint={`Example: 1-3,5,8-9. ${pageCount ? `This PDF has ${pageCount} pages.` : ""}`} />}
      run={async ({ file, bytes }) => {
        const out = await extractPdfPages(await bytes(), pages);
        return { name: withExtension(`${baseName(file.name)}-pages`, ".pdf"), mime: "application/pdf", bytes: out.bytes, pages: out.pageCount, message: `Extracted ${out.pageCount} page${out.pageCount === 1 ? "" : "s"}.` };
      }} />
  );
}
