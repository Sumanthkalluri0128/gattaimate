import { useState } from "react";
import { formatBytes } from "@gattaimate/pdf-core";
import Dropzone from "../components/Dropzone";
import DocumentViewer from "../components/DocumentViewer";
import Notice, { type NoticeState } from "../components/Notice";
import PageHeader from "../components/PageHeader";
import { isImageFile, isPdfFile } from "../lib/browser";

export default function PreviewPage() {
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  function choose(files: File[]) {
    const valid = files.find((item) => isPdfFile(item) || isImageFile(item));
    if (!valid) { if (files.length) setNotice({ kind: "error", text: "Choose a PDF, JPG, JPEG or PNG file." }); return; }
    setNotice(null);
    setFile(valid);
  }

  return (
    <div className="page">
      <PageHeader id="preview" />
      {file ? (
        <>
          <section className="card file-card">
            <div className="file-info">
              <div className="file-name" title={file.name}>{file.name}</div>
              <div className="file-meta">{formatBytes(file.size)}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>Choose another</button>
          </section>
          <DocumentViewer key={`${file.name}-${file.size}-${file.lastModified}`} file={file} />
        </>
      ) : (
        <Dropzone accept="application/pdf,.pdf,image/jpeg,image/png,.jpg,.jpeg,.png" title="Drop a PDF or image to preview" hint="Nothing is uploaded — it opens right here" buttonLabel="Choose a file" onFiles={choose} />
      )}
      <Notice notice={notice} />
    </div>
  );
}
