import { useCallback, useRef, useState } from "react";
import { baseName, formatBytes, getPdfPageCount, mergePdfBuffers, withExtension, type Rotation } from "@gattaimate/pdf-core";
import Dropzone from "../components/Dropzone";
import DocumentViewer from "../components/DocumentViewer";
import Modal from "../components/Modal";
import Notice, { type NoticeState } from "../components/Notice";
import PageHeader from "../components/PageHeader";
import { AlertIcon, ArrowDownIcon, ArrowUpIcon, DragIcon, PlusIcon, RotateIcon, ShieldIcon, ToolIcon } from "../components/icons";
import { downloadBytes, errorMessage, isImageFile, isPdfFile, newId, readBytes } from "../lib/browser";
import { useRecent } from "../hooks/useRecent";

type Mode = "merge" | "images";
type Item = { id: string; file: File; pages?: number; problem?: string; rotation: Rotation };

const MODES = {
  merge: {
    header: "merge" as const,
    accept: "application/pdf,.pdf,image/jpeg,image/png,.jpg,.jpeg,.png",
    test: (file: File) => isPdfFile(file) || isImageFile(file),
    title: "Drop PDFs and images here",
    hint: "PDF, JPG, JPEG or PNG — each image becomes one page",
    button: "Choose PDFs & images",
    suffix: "merged"
  },
  images: {
    header: "images" as const,
    accept: "image/jpeg,image/png,.jpg,.jpeg,.png",
    test: isImageFile,
    title: "Drop photos or scans here",
    hint: "JPG, JPEG or PNG — one image per page, fitted to A4",
    button: "Choose images",
    suffix: "images"
  }
};

const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

export default function MergePage({ mode }: { mode: Mode }) {
  const spec = MODES[mode];
  const recent = useRecent();
  const [items, setItems] = useState<Item[]>([]);
  const [outputName, setOutputName] = useState("");
  const nameEdited = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [preview, setPreview] = useState<File | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const closePreview = useCallback(() => setPreview(null), []);
  const patch = (id: string, change: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));

  async function addFiles(files: File[]) {
    const valid = files.filter(spec.test);
    const unsupported = files.length - valid.length;
    const known = new Set(items.map((item) => fileKey(item.file)));
    const fresh = valid.filter((file) => !known.has(fileKey(file)));
    const duplicates = valid.length - fresh.length;

    const skipped = [unsupported && `${unsupported} unsupported`, duplicates && `${duplicates} already added`].filter(Boolean).join(", ");
    setNotice(skipped ? { kind: "info", text: `Skipped ${skipped}.` } : null);
    if (fresh.length === 0) return;

    const added: Item[] = fresh.map((file) => ({ id: newId(), file, rotation: 0, pages: isImageFile(file) && !isPdfFile(file) ? 1 : undefined }));
    if (items.length === 0 && !nameEdited.current) setOutputName(`${baseName(fresh[0].name) || "gattaimate"}-${spec.suffix}.pdf`);
    setItems((current) => [...current, ...added]);

    // Read page counts one at a time so large batches don't spike memory.
    for (const item of added) {
      if (item.pages !== undefined) continue;
      try {
        patch(item.id, { pages: await getPdfPageCount(await readBytes(item.file), item.file.name) });
      } catch (error) {
        patch(item.id, { problem: errorMessage(error, "This PDF could not be read.") });
      }
    }
  }

  function move(from: number, to: number) {
    if (from === to || to < 0) return;
    setItems((current) => {
      if (to >= current.length) return current;
      const next = [...current];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    if (items.length <= 1) clearAll();
  }

  function clearAll() {
    setItems([]);
    setNotice(null);
    nameEdited.current = false;
    setOutputName("");
  }

  async function createPdf() {
    if (items.length === 0 || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const inputs = [];
      for (const item of items) inputs.push({ name: item.file.name, bytes: await readBytes(item.file), rotation: item.rotation });
      const result = await mergePdfBuffers(inputs);
      const name = withExtension(outputName, ".pdf", `gattaimate-${spec.suffix}`);
      const size = downloadBytes(result.bytes, name);
      recent.add({ name, tool: mode === "merge" ? "Merge" : "Images to PDF", pages: result.pageCount, size });
      setNotice({ kind: "success", text: `Created ${name}: ${items.length} ${items.length === 1 ? "file" : "files"} → ${result.pageCount} ${result.pageCount === 1 ? "page" : "pages"} (${formatBytes(size)}).` });
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error, "Could not create the PDF. Please try again.") });
    } finally {
      setBusy(false);
    }
  }

  const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
  const knownPages = items.reduce((sum, item) => sum + (item.pages ?? 0), 0);
  const hasProblem = items.some((item) => item.problem);

  return (
    <div className="page">
      <PageHeader id={spec.header} blurb={mode === "merge" ? "Combine PDFs and images into one document. Drag rows or use the arrows to set the order." : undefined} />

      <Dropzone accept={spec.accept} multiple compact={items.length > 0} title={spec.title} hint={spec.hint} buttonLabel={items.length ? "Add more files" : spec.button} onFiles={(files) => void addFiles(files)} />

      {items.length > 0 && (
        <section className="card" aria-label="Files to combine">
          <div className="card-title">
            <div><h2>Your files</h2><small>{items.length} {items.length === 1 ? "file" : "files"} · pages are combined top to bottom</small></div>
            <button className="btn btn-ghost btn-sm" onClick={clearAll} disabled={busy}>Clear all</button>
          </div>
          <ol className="file-list">
            {items.map((item, index) => {
              const image = isImageFile(item.file) && !isPdfFile(item.file);
              return (
                <li
                  key={item.id}
                  className={`file-row${dragFrom === index ? " dragging" : ""}${dragOver === index && dragFrom !== index ? " drop-target" : ""}${item.problem ? " has-problem" : ""}`}
                  draggable
                  onDragStart={(event) => { setDragFrom(index); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); }}
                  onDragOver={(event) => { if (dragFrom !== null) { event.preventDefault(); setDragOver(index); } }}
                  onDrop={(event) => { event.preventDefault(); if (dragFrom !== null) move(dragFrom, index); setDragFrom(null); setDragOver(null); }}
                  onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                >
                  <span className="drag-handle" aria-hidden="true"><DragIcon size={16} /></span>
                  <span className={`file-badge ${image ? "image" : ""}`}>{image ? "IMG" : "PDF"}</span>
                  <div className="file-info">
                    <div className="file-name" title={item.file.name}>{item.file.name}</div>
                    <div className="file-meta">
                      {formatBytes(item.file.size)} · {item.problem ? <span className="problem"><AlertIcon size={12} /> {item.problem}</span> : item.pages === undefined ? "reading pages…" : `${item.pages} ${item.pages === 1 ? "page" : "pages"}`}
                      {item.rotation > 0 && <span className="chip">↻ {item.rotation}°</span>}
                    </div>
                  </div>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setPreview(item.file)}>Preview</button>
                    <button className="icon-button" aria-label={`Rotate ${item.file.name} clockwise`} title="Rotate 90° clockwise in the final PDF" onClick={() => patch(item.id, { rotation: ((item.rotation + 90) % 360) as Rotation })}><RotateIcon size={16} /></button>
                    <button className="icon-button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUpIcon size={16} /></button>
                    <span className="order">{index + 1}</span>
                    <button className="icon-button" aria-label="Move down" disabled={index === items.length - 1} onClick={() => move(index, index + 1)}><ArrowDownIcon size={16} /></button>
                    <button className="icon-button danger" aria-label={`Remove ${item.file.name}`} onClick={() => remove(item.id)}>×</button>
                  </div>
                </li>
              );
            })}
          </ol>
          <button className="add-more" onClick={() => document.querySelector<HTMLInputElement>(".dropzone input[type=file]")?.click()}><PlusIcon size={16} /> Add more files</button>
        </section>
      )}

      <section className="card create-card">
        <div className="field">
          <label htmlFor="output-name">Output file name</label>
          <input id="output-name" value={outputName} maxLength={100} placeholder={`gattaimate-${spec.suffix}.pdf`} autoComplete="off" onChange={(event) => { nameEdited.current = true; setOutputName(event.target.value); }} />
        </div>
        <div className="summary">
          <span>{items.length} {items.length === 1 ? "file" : "files"}{knownPages ? ` · ${knownPages} pages` : ""}</span>
          <span>{formatBytes(totalSize)} total</span>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy || items.length === 0 || hasProblem} onClick={() => void createPdf()}>
          {busy ? <span className="spinner" /> : <ToolIcon id="merge" size={18} />}
          {busy ? "Creating your PDF…" : items.length === 0 ? "Add files to begin" : "Create PDF"}
        </button>
        {hasProblem && <p className="fine-print warn">Remove the files marked with a warning, then try again.</p>}
        <p className="fine-print"><ShieldIcon size={14} /> Processed in your browser. Your documents are never uploaded.</p>
      </section>

      <Notice notice={notice} />
      {preview && <Modal title={preview.name} onClose={closePreview}><DocumentViewer key={fileKey(preview)} file={preview} /></Modal>}
    </div>
  );
}
