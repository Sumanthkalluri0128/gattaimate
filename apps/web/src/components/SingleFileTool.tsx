import { useRef, useState, type ReactNode } from "react";
import { formatBytes, getPdfPageCount } from "@gattaimate/pdf-core";
import { toolById, type ToolId } from "../tools";
import { errorMessage, isImageFile, isPdfFile, readBytes } from "../lib/browser";
import { useRecent } from "../hooks/useRecent";
import Dropzone from "./Dropzone";
import Notice, { type NoticeState } from "./Notice";
import PageHeader from "./PageHeader";
import { FileIcon } from "./icons";

export type ToolContext = {
  file: File;
  pageCount: number | null;
  bytes: () => Promise<Uint8Array>;
  progress: (text: string) => void;
};
export type ToolResult = { message: string; name: string; size: number; pages?: number };

type Props = {
  id: ToolId;
  accept: "pdf" | "image";
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
export default function SingleFileTool({ id, accept, actionLabel, options, run }: Props) {
  const spec = ACCEPT[accept];
  const tool = toolById(id);
  const recent = useRecent();
  const loadToken = useRef(0);

  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);

  async function choose(files: File[]) {
    const valid = files.filter(spec.test);
    if (valid.length === 0) {
      if (files.length) setNotice({ kind: "error", text: `That file isn't supported here. Choose ${spec.noun}.` });
      return;
    }
    const chosen = valid[0];
    const token = ++loadToken.current;
    setFile(chosen);
    setPageCount(null);
    setUnreadable(false);
    setNotice(valid.length > 1 ? { kind: "info", text: `This tool works on one file at a time — using “${chosen.name}”.` } : null);

    if (accept === "pdf") {
      try {
        const count = await getPdfPageCount(await readBytes(chosen), chosen.name);
        if (token === loadToken.current) setPageCount(count);
      } catch (error) {
        if (token !== loadToken.current) return;
        setUnreadable(true);
        setNotice({ kind: "error", text: errorMessage(error, "This PDF could not be read.") });
      }
    }
  }

  function reset() {
    loadToken.current++;
    setFile(null); setPageCount(null); setUnreadable(false); setNotice(null);
  }

  async function submit() {
    if (!file || busy) return;
    setBusy(true);
    setNotice(null);
    setStatus("");
    try {
      const result = await run({ file, pageCount, bytes: () => readBytes(file), progress: setStatus });
      recent.add({ name: result.name, tool: tool.title, pages: result.pages, size: result.size });
      setNotice({ kind: "success", text: result.message });
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
                {accept === "pdf" && !unreadable && <> · {pageCount === null ? "reading pages…" : `${pageCount} ${pageCount === 1 ? "page" : "pages"}`}</>}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={reset}>Change file</button>
          </section>

          {!unreadable && (
            <section className="card options">
              {options?.({ file, pageCount })}
              <button className="btn btn-primary btn-block" disabled={busy || (accept === "pdf" && pageCount === null)} onClick={() => void submit()}>
                {busy && <span className="spinner" />}
                {busy ? status || "Working…" : actionLabel}
              </button>
              <p className="fine-print">Your original file is never changed. Everything runs in this browser tab.</p>
            </section>
          )}
        </>
      )}
      <Notice notice={notice} />
    </div>
  );
}
