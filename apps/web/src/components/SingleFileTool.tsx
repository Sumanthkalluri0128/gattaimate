import { useCallback, useRef, useState, type ReactNode } from "react";
import { formatBytes, getPdfPageCount } from "@gattaimate/pdf-core";
import { toolById, type ToolId } from "../tools";
import { errorMessage, isImageFile, isLockedError, isPdfFile, readBytes } from "../lib/browser";
import { openLockedPdf } from "../lib/unlock";
import { useRecent } from "../hooks/useRecent";
import Dropzone from "./Dropzone";
import DocumentViewer from "./DocumentViewer";
import Modal from "./Modal";
import Notice, { type NoticeState } from "./Notice";
import SizeCompare from "./SizeCompare";
import PageHeader from "./PageHeader";
import UnlockPrompt from "./UnlockPrompt";
import { FileIcon } from "./icons";

export type ToolContext = {
  file: File;
  pageCount: number | null;
  bytes: () => Promise<Uint8Array>;
  progress: (text: string) => void;
};
export type ToolResult = { message: string; name: string; size: number; pages?: number; /** original size, to show a before/after comparison */ before?: number };

type Props = {
  id: ToolId;
  accept: "pdf" | "image";
  /** Set false for tools that must accept password-protected PDFs (skips reading the page count). */
  readPages?: boolean;
  actionLabel: string;
  /** Options UI, rendered once a file is chosen. Own the option state in the page. */
  options?: (info: { file: File; pageCount: number | null }) => ReactNode;
  run: (context: ToolContext) => Promise<ToolResult>;
};

const ACCEPT = {
  pdf: { attr: "application/pdf,.pdf", test: isPdfFile, title: "Drop a PDF here", hint: "or choose one from your device", button: "Choose a PDF", noun: "a PDF" },
  image: { attr: "image/jpeg,image/png,.jpg,.jpeg,.png", test: isImageFile, title: "Drop an image here", hint: "JPG, JPEG or PNG", button: "Choose an image", noun: "a JPG, JPEG or PNG image" }
} as const;

/** One file in → options → one action. Used by Split, Extract, Rotate and both Optimize tools. */
export default function SingleFileTool({ id, accept, readPages = true, actionLabel, options, run }: Props) {
  const needsPages = accept === "pdf" && readPages;
  const spec = ACCEPT[accept];
  const tool = toolById(id);
  const recent = useRecent();
  const loadToken = useRef(0);

  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);
  const [compare, setCompare] = useState<{ before: number; after: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const closePreview = useCallback(() => setPreviewing(false), []);

  /** Read the page count. A locked PDF first gets a silent empty-password attempt (many only restrict editing), then a prompt. */
  async function load(chosen: File, note: NoticeState = null) {
    const token = ++loadToken.current;
    setFile(chosen);
    setPageCount(null);
    setUnreadable(false);
    setLocked(false);
    setCompare(null);
    setNotice(note);
    if (!needsPages) return;
    try {
      const count = await getPdfPageCount(await readBytes(chosen), chosen.name);
      if (token === loadToken.current) setPageCount(count);
    } catch (error) {
      if (token !== loadToken.current) return;
      if (isLockedError(error)) {
        try {
          const opened = await openLockedPdf(chosen, "");
          if (token !== loadToken.current) return;
          await load(opened, { kind: "info", text: "This PDF only had editing restrictions, no open-password — it was opened for you. Results are saved without those restrictions." });
        } catch {
          if (token === loadToken.current) setLocked(true);
        }
        return;
      }
      setUnreadable(true);
      setNotice({ kind: "error", text: errorMessage(error, "This PDF could not be read.") });
    }
  }

  async function choose(files: File[]) {
    const valid = files.filter(spec.test);
    if (valid.length === 0) {
      if (files.length) setNotice({ kind: "error", text: `That file isn't supported here. Choose ${spec.noun}.` });
      return;
    }
    await load(valid[0], valid.length > 1 ? { kind: "info", text: `This tool works on one file at a time — using “${valid[0].name}”.` } : null);
  }

  async function unlock(password: string) {
    const opened = await openLockedPdf(file!, password);
    await load(opened, { kind: "success", text: "Unlocked for this session. Your original file is unchanged, and results are saved without a password — use Protect / Unlock to lock them again." });
  }

  function reset() {
    loadToken.current++;
    setFile(null); setPageCount(null); setUnreadable(false); setLocked(false); setNotice(null); setCompare(null);
  }

  async function submit() {
    if (!file || busy) return;
    setBusy(true);
    setNotice(null);
    setCompare(null);
    setStatus("");
    try {
      const result = await run({ file, pageCount, bytes: () => readBytes(file), progress: setStatus });
      recent.add({ name: result.name, tool: tool.title, pages: result.pages, size: result.size });
      setNotice({ kind: "success", text: result.message });
      setCompare(result.before ? { before: result.before, after: result.size } : null);
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error, "Something went wrong. Please try again.") });
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="page">
      <PageHeader id={id} />
      {!file ? (
        <Dropzone accept={spec.attr} title={spec.title} hint={spec.hint} buttonLabel={spec.button} onFiles={(files) => void choose(files)} />
      ) : (
        <>
          <section className="card file-card">
            <span className="file-badge"><FileIcon size={22} /></span>
            <div className="file-info">
              <div className="file-name" title={file.name}>{file.name}</div>
              <div className="file-meta">
                {formatBytes(file.size)}
                {needsPages && !unreadable && !locked && <> · {pageCount === null ? "reading pages…" : `${pageCount} ${pageCount === 1 ? "page" : "pages"}`}</>}
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={busy || unreadable || locked} onClick={() => setPreviewing(true)}>Preview</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={reset}>Change file</button>
          </section>

          {locked && <section className="card"><UnlockPrompt name={file.name} onUnlock={unlock} /></section>}
          {!unreadable && !locked && (
            <section className="card options">
              {options?.({ file, pageCount })}
              <button className="btn btn-primary btn-block" data-primary disabled={busy || (needsPages && pageCount === null)} onClick={() => void submit()}>
                {busy && <span className="spinner" />}
                {busy ? status || "Working…" : actionLabel}
              </button>
              <p className="fine-print">Your original file is never changed. Everything runs in this browser tab.</p>
            </section>
          )}
        </>
      )}
      <Notice notice={notice} />
      {compare && <SizeCompare before={compare.before} after={compare.after} />}
      {previewing && file && (
        <Modal title={file.name} onClose={closePreview}>
          <DocumentViewer key={`${file.name}-${file.size}-${file.lastModified}`} file={file} />
        </Modal>
      )}
    </div>
  );
}
