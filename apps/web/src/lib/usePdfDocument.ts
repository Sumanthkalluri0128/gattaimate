import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfjs } from "./pdfjs";
import { errorMessage, readBytes } from "./browser";

/** Load a PDF with pdf.js once per file. Returns the document, or an error message. */
export function usePdfDocument(file: File | null) {
  const [state, setState] = useState<{ doc: PDFDocumentProxy | null; error: string }>({ doc: null, error: "" });

  useEffect(() => {
    if (!file) { setState({ doc: null, error: "" }); return; }
    let cancelled = false;
    let destroy: (() => void) | undefined;
    setState({ doc: null, error: "" });
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const task = pdfjs.getDocument({ data: await readBytes(file) });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        if (!cancelled) setState({ doc, error: "" });
      } catch (error) {
        if (!cancelled) setState({ doc: null, error: errorMessage(error, "Could not open this PDF. It may be damaged or password-protected.") });
      }
    })();
    return () => { cancelled = true; destroy?.(); };
  }, [file]);

  return state;
}
