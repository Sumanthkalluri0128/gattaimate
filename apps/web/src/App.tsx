import { useMemo, useRef, useState } from "react";
import { mergePdfBuffers } from "@gattaimate/pdf-core";

type PdfItem = {
  id: string;
  file: File;
  pages?: number;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PdfItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [outputName, setOutputName] = useState("gattaimate-merged.pdf");

  const totalSize = useMemo(() => items.reduce((sum, item) => sum + item.file.size, 0), [items]);
  const totalPages = useMemo(() => items.reduce((sum, item) => sum + (item.pages ?? 0), 0), [items]);

  async function addFiles(fileList: FileList | File[]) {
    const chosen = Array.from(fileList).filter((file) =>
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );
    const rejected = fileList.length - chosen.length;
    if (rejected) setMessage(`${rejected} non-PDF file(s) skipped.`);
    else setMessage("");

    const existing = new Set(items.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
    const fresh = chosen.filter((file) => !existing.has(`${file.name}:${file.size}:${file.lastModified}`));
    const newItems: PdfItem[] = fresh.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file
    }));
    setItems((current) => [...current, ...newItems]);

    // Page counts are useful metadata. Failure to read one file should not block selection.
    for (const item of newItems) {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(await item.file.arrayBuffer(), { updateMetadata: false });
        setItems((current) => current.map((row) => row.id === item.id ? { ...row, pages: doc.getPageCount() } : row));
      } catch {
        setMessage(`Could not preview page count for "${item.file.name}". It may be encrypted or damaged.`);
      }
    }
  }

  function move(index: number, delta: number) {
    setItems((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function merge() {
    if (items.length < 2) {
      setMessage("Add at least two PDF files to get started.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const inputs = await Promise.all(items.map(async (item) => ({
        name: item.file.name,
        bytes: new Uint8Array(await item.file.arrayBuffer())
      })));
      const result = await mergePdfBuffers(inputs);
      const blob = new Blob([result.bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = outputName.trim().toLowerCase().endsWith(".pdf")
        ? outputName.trim()
        : `${outputName.trim() || "gattaimate-merged"}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setMessage(`Done — merged ${items.length} files into ${result.pageCount} pages.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not merge these files. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <a className="brand" href="#" aria-label="GattaiMate home">
          <span className="brand-mark">G</span>
          <span>Gattai<span className="brand-light">Mate</span></span>
        </a>
        <div className="privacy-pill"><span className="privacy-dot" /> Private by design</div>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span className="sparkle">✦</span> YOUR DOCUMENTS, BEAUTIFULLY TOGETHER</div>
        <h1>Every PDF.<br /><span>One seamless file.</span></h1>
        <p className="hero-copy">Bring your documents together in seconds. Simple, secure, and always in your control.</p>
      </section>

      <section className="workspace">
        <div className="workspace-heading">
          <div>
            <div className="section-kicker">WORKSPACE</div>
            <h2>Merge your PDFs</h2>
            <p>Arrange your files in the order you want them to appear.</p>
          </div>
          <div className="file-count">{items.length} {items.length === 1 ? "file" : "files"}</div>
        </div>

        <div
          className={`dropzone ${dragging ? "dropzone-active" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles(event.dataTransfer.files); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="upload-icon"><UploadIcon /></div>
          <h3>Drop your PDFs right here</h3>
          <p>or choose files from your device</p>
          <button className="button button-secondary" onClick={() => inputRef.current?.click()}>
            <PlusIcon /> Choose PDF files
          </button>
          <div className="dropzone-footnote"><ShieldIcon /> Files stay on your device · No account required</div>
        </div>

        {items.length > 0 && (
          <div className="file-panel">
            <div className="file-panel-title">
              <div><h3>Your documents</h3><span>Use the arrows to set the final order.</span></div>
              <button className="text-button" onClick={() => { setItems([]); setMessage(""); }}>Clear all</button>
            </div>
            <div className="file-list">
              {items.map((item, index) => (
                <article className="file-row" key={item.id}>
                  <div className="pdf-icon"><FileIcon /></div>
                  <div className="file-info">
                    <div className="file-name" title={item.file.name}>{item.file.name}</div>
                    <div className="file-meta">{formatBytes(item.file.size)} <span>·</span> {item.pages === undefined ? "Reading pages…" : `${item.pages} ${item.pages === 1 ? "page" : "pages"}`}</div>
                  </div>
                  <div className="order-controls" aria-label={`Order controls for ${item.file.name}`}>
                    <button aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <button aria-label="Move down" disabled={index === items.length - 1} onClick={() => move(index, 1)}>↓</button>
                  </div>
                  <button className="remove-button" aria-label={`Remove ${item.file.name}`} onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>×</button>
                </article>
              ))}
            </div>
            <button className="add-more" onClick={() => inputRef.current?.click()}><PlusIcon /> Add more PDFs</button>
          </div>
        )}

        <div className="merge-card">
          <div className="merge-card-top">
            <div className="merge-symbol"><MergeIcon /></div>
            <div className="merge-copy"><h3>Ready to bring it all together?</h3><p>Your original files will remain untouched.</p></div>
          </div>
          <label className="output-label" htmlFor="output-name">OUTPUT FILE NAME</label>
          <input id="output-name" className="output-input" value={outputName} onChange={(event) => setOutputName(event.target.value)} maxLength={100} />
          <div className="summary-line">
            <span>{items.length} files <i>·</i> {totalPages ? `${totalPages} pages detected` : "page count pending"}</span>
            <span>{formatBytes(totalSize)} total</span>
          </div>
          <button className="button button-primary merge-button" disabled={busy || items.length < 2} onClick={() => void merge()}>
            {busy ? <span className="spinner" /> : <MergeIcon />}
            {busy ? "Merging your PDFs…" : "Merge PDFs"}
            {!busy && <span className="button-arrow">↗</span>}
          </button>
          <div className="secure-note"><ShieldIcon /> Processed locally in your browser. Your documents are never uploaded.</div>
        </div>
        {message && <div className={`notice ${message.startsWith("Done") ? "notice-success" : ""}`} role="status">{message}</div>}
      </section>

      <section className="trust-row">
        <div><span className="trust-icon">⌁</span><strong>Private by default</strong><small>Your files stay yours.</small></div>
        <div><span className="trust-icon">◈</span><strong>Keep your order</strong><small>You decide what comes first.</small></div>
        <div><span className="trust-icon">↯</span><strong>Fast and simple</strong><small>No account or upload wait.</small></div>
      </section>
      <footer><span>© {new Date().getFullYear()} GattaiMate</span><span>Made for documents that belong together.</span></footer>
    </main>
  );
}

function UploadIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3" /></svg>; }
function PlusIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>; }
function ShieldIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4" /></svg>; }
function FileIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5v5h4M8 13h8M8 16h8" /></svg>; }
function MergeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4a5 5 0 0 0 5 5h5M17 8l3 4-3 4M7 21v-4a5 5 0 0 1 5-5" /></svg>; }
