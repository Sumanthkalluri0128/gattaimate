/**
 * pdf.js is large, so it is only fetched the first time a page that renders PDFs needs it.
 *
 * The *legacy* build is used on purpose: the default build relies on very new JavaScript
 * (e.g. Map.prototype.getOrInsertComputed) and throws "getOrInsertComputed is not a function"
 * on many current browsers. The legacy build and its worker include the needed polyfills.
 */
type PdfjsModule = typeof import("pdfjs-dist");

let pending: Promise<PdfjsModule> | null = null;

export function loadPdfjs(): Promise<PdfjsModule> {
  pending ??= (async () => {
    const [lib, worker] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs") as Promise<PdfjsModule>,
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")
    ]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })().catch((error) => { pending = null; throw error; });
  return pending;
}
