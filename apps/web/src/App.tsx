import { useEffect, useMemo, useRef, useState } from "react";
import { mergePdfBuffers, splitPdfByRanges, rotatePdfPages, extractPdfPages } from "@gattaimate/pdf-core";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type ToolMode = "split" | "rotate" | "extract" | "compress" | "optimize-image" | "preview" | null;

type MergeItem = {
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
  const [items, setItems] = useState<MergeItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [outputName, setOutputName] = useState("gattaimate-merged.pdf");
  const [outputNameEdited, setOutputNameEdited] = useState(false);
  const [recentFiles, setRecentFiles] = useState<{ name: string; pages: number; size: number; createdAt: string }[]>([]);
  const [activeTool, setActiveTool] = useState<ToolMode>(null);
  const [pageRange, setPageRange] = useState("1-2,3-4");
  const [rotation, setRotation] = useState<90 | 180 | 270>(90);
  const [targetFileId, setTargetFileId] = useState("");
  const [imageQuality, setImageQuality] = useState(78);
  const [viewerItem, setViewerItem] = useState<MergeItem | null>(null);
  const [viewerRotation, setViewerRotation] = useState<0 | 90 | 180 | 270>(0);
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerPageCount, setViewerPageCount] = useState(0);
  const [viewerUrl, setViewerUrl] = useState("");
  const viewerCanvasRef = useRef<HTMLCanvasElement>(null);

  const totalSize = useMemo(() => items.reduce((sum, item) => sum + item.file.size, 0), [items]);
  const totalPages = useMemo(() => items.reduce((sum, item) => sum + (item.pages ?? 0), 0), [items]);

  useEffect(() => {
    if (!activeTool) return;
    const eligible = items.filter((item) => activeTool === "optimize-image"
      ? /\.(jpe?g|png)$/i.test(item.file.name)
      : activeTool === "preview" || item.file.name.toLowerCase().endsWith(".pdf"));
    if (!eligible.some((item) => item.id === targetFileId)) setTargetFileId(eligible[0]?.id ?? "");
  }, [activeTool, items, targetFileId]);

  async function addFiles(fileList: FileList | File[]) {
    const chosen = Array.from(fileList).filter((file) => {
      const name = file.name.toLowerCase();
      return file.type === "application/pdf" || file.type === "image/jpeg" || file.type === "image/png" || /\.(pdf|jpe?g|png)$/.test(name);
    });
    const rejected = fileList.length - chosen.length;
    if (rejected) setMessage(`${rejected} unsupported file(s) skipped. Choose PDF, JPG, JPEG, or PNG files.`);
    else setMessage("");

    const existing = new Set(items.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
    const fresh = chosen.filter((file) => !existing.has(`${file.name}:${file.size}:${file.lastModified}`));
    const newItems: MergeItem[] = fresh.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file
    }));
    if (newItems.length > 0 && items.length === 0 && !outputNameEdited) {
      const firstBaseName = newItems[0].file.name.replace(/\.(pdf|jpe?g|png)$/i, "").trim();
      setOutputName(`${firstBaseName || "gattaimate"}-merged.pdf`);
    }
    setItems((current) => [...current, ...newItems]);

    // Page counts are useful metadata. Failure to read one file should not block selection.
    for (const item of newItems) {
      try {
        const lowerName = item.file.name.toLowerCase();
        if (/\.(jpe?g|png)$/.test(lowerName) || item.file.type.startsWith("image/")) {
          setItems((current) => current.map((row) => row.id === item.id ? { ...row, pages: 1 } : row));
        } else {
          const { PDFDocument } = await import("pdf-lib");
          const doc = await PDFDocument.load(await item.file.arrayBuffer(), { updateMetadata: false });
          setItems((current) => current.map((row) => row.id === item.id ? { ...row, pages: doc.getPageCount() } : row));
        }
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

  function downloadPdf(bytes: Uint8Array, filename: string) {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    return blob.size;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    return blob.size;
  }

  async function loadImage(file: File): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not open image ${file.name}.`));
        image.src = url;
      });
    } finally { window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
  }

  async function optimizeImageFile(file: File, quality: number) {
    const image = await loadImage(file);
    const maxSide = 2400;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Your browser could not create an image canvas.");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image optimization failed.")), "image/jpeg", quality / 100));
    canvas.width = 0; canvas.height = 0;
    return { blob, name: `${file.name.replace(/\.(jpe?g|png)$/i, "")}-optimized.jpg` };
  }

  function openItem(item: MergeItem, startRotate = false) {
    setViewerItem(item);
    setViewerRotation(startRotate ? 90 : 0);
    setViewerPage(1);
    setViewerPageCount(0);
    setMessage("");
  }

  useEffect(() => {
    if (!viewerItem) {
      setViewerUrl("");
      return;
    }
    const url = URL.createObjectURL(viewerItem.file);
    setViewerUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [viewerItem]);

  useEffect(() => {
    if (!viewerItem || !viewerItem.file.name.toLowerCase().endsWith(".pdf")) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | undefined;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | undefined;

    async function renderPage() {
      try {
        const bytes = new Uint8Array(await viewerItem!.file.arrayBuffer());
        if (cancelled) return;
        loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        if (cancelled) { await loadingTask.destroy(); return; }
        setViewerPageCount(pdf.numPages);
        const pageNumber = Math.min(Math.max(1, viewerPage), pdf.numPages);
        const page = await pdf.getPage(pageNumber);
        if (cancelled) { await loadingTask.destroy(); return; }
        const canvas = viewerCanvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) throw new Error("Could not create the PDF preview canvas.");
        const viewport = page.getViewport({ scale: 1.25, rotation: (page.rotate + viewerRotation) % 360 });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        page.cleanup();
        await loadingTask.destroy();
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          setMessage(error instanceof Error ? `PDF preview failed: ${error.message}` : "Could not render this PDF.");
        }
      }
    }
    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      if (loadingTask) void loadingTask.destroy();
    };
  }, [viewerItem, viewerPage, viewerRotation]);

  async function saveViewerRotation() {
    if (!viewerItem || viewerRotation === 0) {
      setMessage("Rotate the preview first, then choose Save rotated copy.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const base = viewerItem.file.name.replace(/\.(pdf|jpe?g|png)$/i, "");
      if (viewerItem.file.name.toLowerCase().endsWith(".pdf")) {
        const result = await rotatePdfPages(new Uint8Array(await viewerItem.file.arrayBuffer()), viewerRotation, "all");
        const size = downloadPdf(result.bytes, `${base}-rotated.pdf`);
        setMessage(`Done — saved rotated copy (${formatBytes(size)}). Original unchanged.`);
      } else {
        const image = await loadImage(viewerItem.file);
        const sideways = viewerRotation === 90 || viewerRotation === 270;
        const canvas = document.createElement("canvas");
        canvas.width = sideways ? image.naturalHeight : image.naturalWidth;
        canvas.height = sideways ? image.naturalWidth : image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not create an image canvas.");
        context.translate(canvas.width / 2, canvas.height / 2);
        context.rotate(viewerRotation * Math.PI / 180);
        context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not rotate image.")), "image/jpeg", 0.92));
        downloadBlob(blob, `${base}-rotated.jpg`);
        canvas.width = 0; canvas.height = 0;
        setMessage(`Done — saved rotated image (${formatBytes(blob.size)}). Original unchanged.`);
      }
      setViewerItem(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not rotate this file.");
    } finally { setBusy(false); }
  }


  function openTool(tool: Exclude<ToolMode, null>) {
    setActiveTool(tool);
    const firstEligible = items.find((item) => tool === "optimize-image" ? /\.(jpe?g|png)$/i.test(item.file.name) : item.file.name.toLowerCase().endsWith(".pdf"));
    setTargetFileId(firstEligible?.id ?? "");
    setPageRange(tool === "split" ? "1-2;3-4" : tool === "extract" ? "1-3" : "all");
    setMessage("");
    document.getElementById("merge-workspace")?.scrollIntoView({ behavior: "smooth" });
    if (tool === "preview") {
      const firstPdf = items.find((item) => item.id === targetFileId) ?? items.find((item) => item.file.name.toLowerCase().endsWith(".pdf"));
      if (!firstPdf) {
        setMessage("Add a PDF first, then choose Preview PDF again.");
        return;
      }
      openItem(firstPdf);
    }
  }

  async function runTool() {
    if (!activeTool || activeTool === "preview") return;
    const file = items.find((item) => item.id === targetFileId);
    if (!file) { setMessage(activeTool === "optimize-image" ? "Choose an image first." : "Choose the PDF you want to process."); return; }
    if (activeTool !== "optimize-image" && !file.file.name.toLowerCase().endsWith(".pdf")) { setMessage("This tool needs a PDF. Choose a PDF in the source selector."); return; }
    if (activeTool === "optimize-image" && !/\.(jpe?g|png)$/i.test(file.file.name)) { setMessage("Choose a JPG, JPEG or PNG image to optimize."); return; }
    setBusy(true);
    setMessage("");
    try {
      const bytes = new Uint8Array(await file.file.arrayBuffer());
      const base = file.file.name.replace(/\.pdf$/i, "");
      if (activeTool === "split") {
        const results = await splitPdfByRanges(bytes, pageRange);
        results.forEach((result, index) => downloadPdf(result.bytes, `${base}-part-${index + 1}.pdf`));
        setMessage(`Done — created ${results.length} PDF parts. If your browser blocks multiple downloads, allow them for this site.`);
      } else if (activeTool === "extract") {
        const result = await extractPdfPages(bytes, pageRange);
        const size = downloadPdf(result.bytes, `${base}-pages.pdf`);
        setMessage(`Done — extracted ${result.pageCount} page(s) into ${formatBytes(size)}.`);
      } else if (activeTool === "rotate") {
        const result = await rotatePdfPages(bytes, rotation, pageRange.trim() || "all");
        const size = downloadPdf(result.bytes, `${base}-rotated.pdf`);
        setMessage(`Done — rotated pages and saved ${formatBytes(size)}.`);
      } else if (activeTool === "compress") {
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const source = await loadingTask.promise;
        const output = await PDFDocument.create();
        const pageCount = source.numPages;
        for (let pageNo = 1; pageNo <= pageCount; pageNo++) {
          const pdfPage = await source.getPage(pageNo);
          const viewport = pdfPage.getViewport({ scale: 1.25 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Your browser could not create an image canvas for PDF optimization.");
          context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
          await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
          const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not compress a PDF page.")), "image/jpeg", imageQuality / 100));
          const jpgBytes = new Uint8Array(await jpeg.arrayBuffer());
          const image = await output.embedJpg(jpgBytes);
          const page = output.addPage([viewport.width, viewport.height]);
          page.drawImage(image, { x: 0, y: 0, width: viewport.width, height: viewport.height });
          canvas.width = 0; canvas.height = 0;
          pdfPage.cleanup();
        }
        await source.destroy();
        const optimized = await output.save({ useObjectStreams: true });
        const size = downloadPdf(optimized, `${base}-optimized.pdf`);
        const delta = file.file.size > 0 ? Math.round((1 - size / file.file.size) * 100) : 0;
        setMessage(`Done — rasterized and recompressed ${pageCount} pages at ${imageQuality}% quality. ${delta > 0 ? `File size reduced by ${delta}%.` : `Output is ${Math.abs(delta)}% ${delta < 0 ? "larger" : "the same size"}; try a lower quality.`} Note: optimized pages are images, so selectable text and links are not preserved. Original: ${formatBytes(file.file.size)}, output: ${formatBytes(size)}.`);
      } else if (activeTool === "optimize-image") {
        const optimized = await optimizeImageFile(file.file, imageQuality);
        const size = downloadBlob(optimized.blob, optimized.name);
        const delta = Math.round((1 - size / file.file.size) * 100);
        setMessage(`Done — optimized image ${delta > 0 ? `and reduced size by ${delta}%` : `but it did not get smaller (${delta < 0 ? `${Math.abs(delta)}% larger` : "same size"})`}. Original: ${formatBytes(file.file.size)}, output: ${formatBytes(size)}.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This PDF could not be processed. Check that it is valid and not password-protected.");
    } finally { setBusy(false); }
  }

  async function merge() {
    if (items.length < 2) {
      setMessage("Add at least one PDF or image file to get started.");
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
      const finalOutputName = outputName.trim().toLowerCase().endsWith(".pdf") ? outputName.trim() : `${outputName.trim() || "gattaimate-merged"}.pdf`;
      setRecentFiles((current) => [{ name: finalOutputName, pages: result.pageCount, size: blob.size, createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...current].slice(0, 4));
      setMessage(`Done — merged ${items.length} files into ${result.pageCount} pages.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not merge these files. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <a className="sidebar-brand" href="#" aria-label="GattaiMate home"><img className="sidebar-logo" src="/gattaimate-icon.svg" alt="" /><span>Gattai<span>Mate</span><small>All your documents. One app.</small></span></a>
        <div className="sidebar-label">WORKSPACE</div>
        <a className="sidebar-link active" href="#home"><span>⌂</span> Home</a>
        <a className="sidebar-link" href="#merge-workspace"><span>▤</span> Merge PDF</a>
        <a className="sidebar-link" href="#merge-workspace"><span>▧</span> Images to PDF</a>
        <button className="sidebar-link" onClick={() => openTool("split")}><span>✂</span> Split PDF</button>
        <button className="sidebar-link" onClick={() => openTool("rotate")}><span>⟳</span> Rotate PDF</button>
        <button className="sidebar-link" onClick={() => openTool("extract")}><span>▤</span> Extract Pages</button>
        <button className="sidebar-link" onClick={() => openTool("compress")}><span>⤢</span> Optimize PDF</button>
        <button className="sidebar-link" onClick={() => openTool("optimize-image")}><span>▧</span> Optimize Image</button>
        <a className="sidebar-link" href="#merge-workspace"><span>▦</span> Organize files</a>
        <a className="sidebar-link" href="#recent-files"><span>◷</span> Recent files</a>
        <div className="sidebar-private"><span>♧</span><strong>100% Private</strong><small>Files stay on your device. Nothing is uploaded.</small></div>
      </aside>
      <main className="app-shell" id="home">
      <nav className="topbar">
        <a className="brand" href="#" aria-label="GattaiMate home">
          <img className="brand-mark-img" src="/gattaimate-icon.svg" alt="" />
          <span>Gattai<span className="brand-light">Mate</span></span>
        </a>
        <label className="top-search"><span>⌕</span><input aria-label="Search tools" placeholder="Search files, tools…" onChange={(event) => { const value = event.target.value.toLowerCase(); document.querySelectorAll<HTMLElement>(".tool-card").forEach((card) => { card.style.display = !value || card.innerText.toLowerCase().includes(value) ? "flex" : "none"; }); }} /></label>
        <div className="top-actions"><span className="privacy-pill"><span className="privacy-dot" /> Private</span><a className="get-app" href="#mobile-app">↓ Get App</a></div>
      </nav>

      <section className="dashboard-hero">
        <div className="dashboard-copy">
          <div className="eyebrow"><span className="sparkle">✦</span> FAST · PRIVATE · OFFLINE</div>
          <h1>Complete <span>PDF</span><br />Toolkit</h1>
          <p className="hero-copy">Merge, convert, split, rotate, compress and organize. All your documents, one powerful app.</p>
          <button className="button button-primary hero-cta" onClick={() => document.getElementById("merge-workspace")?.scrollIntoView({ behavior: "smooth" })}>Start merging <span>→</span></button>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-file art-file-back">▤</div><div className="art-file art-file-front">PDF</div><div className="art-image">▧</div><span className="art-spark spark-a">✦</span><span className="art-spark spark-b">✧</span></div>
      </section>

      <section className="tools-section" aria-labelledby="tools-title">
        <div className="tools-heading"><div><div className="section-kicker">YOUR WORKSPACE</div><h2 id="tools-title">Everything for your documents</h2></div><span className="tool-count">9 tools</span></div>
        <div className="tool-grid">
          <button className="tool-card tool-merge" onClick={() => document.getElementById("merge-workspace")?.scrollIntoView({ behavior: "smooth" })}><span className="tool-icon">▤</span><strong>Merge PDF</strong><small>Combine PDFs and images</small><span className="tool-arrow">↗</span></button>
          <button className="tool-card tool-images" onClick={() => document.getElementById("merge-workspace")?.scrollIntoView({ behavior: "smooth" })}><span className="tool-icon">▧</span><strong>Images to PDF</strong><small>JPG, JPEG and PNG</small><span className="tool-arrow">↗</span></button>
          <button className="tool-card tool-split" onClick={() => openTool("split")}><span className="tool-icon">✂</span><strong>Split PDF</strong><small>Separate a document</small><span className="tool-arrow">↗</span></button>
          <button className="tool-card tool-rotate" onClick={() => openTool("rotate")}><span className="tool-icon">⟳</span><strong>Rotate PDF</strong><small>Correct page orientation</small><span className="tool-arrow">↗</span></button>
          <button className="tool-card tool-extract" onClick={() => openTool("extract")}><span className="tool-icon">▤</span><strong>Extract Pages</strong><small>Keep selected pages</small><span className="tool-arrow">↗</span></button>
          <button className="tool-card tool-compress" onClick={() => openTool("compress")}><span className="tool-icon">⤢</span><strong>Optimize PDF</strong><small>Recompress pages to reduce size</small><span className="tool-arrow">↗</span></button>
          <button className="tool-card tool-images" onClick={() => openTool("optimize-image")}><span className="tool-icon">▧</span><strong>Optimize Image</strong><small>Reduce JPG/PNG file size</small><span className="tool-arrow">↗</span></button>
          <button className="tool-card tool-organize" onClick={() => document.getElementById("merge-workspace")?.scrollIntoView({ behavior: "smooth" })}><span className="tool-icon">▦</span><strong>Organize Files</strong><small>Reorder before merging</small><span className="tool-arrow">↗</span></button>
          <button className="tool-card tool-preview" onClick={() => openTool("preview")}><span className="tool-icon">◉</span><strong>Preview PDF</strong><small>Open selected PDF</small><span className="tool-arrow">↗</span></button>
        </div>
      </section>

      <section className="recent-section" id="recent-files">
        <div className="tools-heading"><div><div className="section-kicker">ON THIS DEVICE</div><h2>Recent files</h2></div><span className="recent-caption">Local history only</span></div>
        <div className="recent-grid">
          {recentFiles.length ? recentFiles.map((file, index) => <div className="recent-card" key={`${file.name}-${index}`}><span className="recent-file-icon pdf-tone">PDF</span><div><strong title={file.name}>{file.name}</strong><small>{file.pages} pages · {formatBytes(file.size)} · {file.createdAt}</small></div></div>) : <div className="recent-empty"><span>◷</span><div><strong>No recent files yet</strong><small>Your completed PDFs will appear here during this session.</small></div></div>}
        </div>
        <p className="demo-note">Recent file names and details stay in this session only. The documents themselves are not retained.</p>
      </section>

      <section className="workspace" id="merge-workspace">
        <div className="workspace-heading">
          <div>
            <div className="section-kicker">WORKSPACE</div>
            <h2>Combine PDFs & images</h2>
            <p>Add PDFs and JPG/PNG images. Each image becomes a page in the final PDF.</p>
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
            accept="application/pdf,.pdf,image/jpeg,image/png,.jpg,.jpeg,.png"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="upload-icon"><UploadIcon /></div>
          <h3>Drop PDFs and images right here</h3>
          <p>or choose files from your device</p>
          <button className="button button-secondary" onClick={() => inputRef.current?.click()}>
            <PlusIcon /> Choose PDFs & images
          </button>
          <div className="dropzone-footnote"><ShieldIcon /> Files stay on your device · No account required</div>
        </div>

        {items.length > 0 && (
          <div className="file-panel">
            <div className="file-panel-title">
              <div><h3>Your documents</h3><span>Use the arrows to set the final order.</span></div>
              <button className="text-button" onClick={() => { setItems([]); setMessage(""); if (!outputNameEdited) setOutputName("gattaimate-merged.pdf"); }}>Clear all</button>
            </div>
            <div className="file-list">
              {items.map((item, index) => (
                <article className="file-row" key={item.id}>
                  <div className={`pdf-icon ${/\.(jpe?g|png)$/i.test(item.file.name) ? "image-icon" : ""}`}><FileIcon /></div>
                  <div className="file-info">
                    <div className="file-name" title={item.file.name}>{item.file.name}</div>
                    <div className="file-meta">{formatBytes(item.file.size)} <span>·</span> {item.pages === undefined ? "Reading pages…" : `${item.pages} ${item.pages === 1 ? "page" : "pages"}`}</div>
                  </div>
                  <div className="order-controls" aria-label={`Order controls for ${item.file.name}`}>
                    <button aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <button aria-label="Move down" disabled={index === items.length - 1} onClick={() => move(index, 1)}>↓</button>
                  </div>
                  <div className="file-actions"><button className="text-button file-action" onClick={() => openItem(item)}>Open</button><button className="text-button file-action" disabled={busy} onClick={() => openItem(item, true)}>↻ Rotate</button></div>
                  <button className="remove-button" aria-label={`Remove ${item.file.name}`} onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>×</button>
                </article>
              ))}
            </div>
            <button className="add-more" onClick={() => inputRef.current?.click()}><PlusIcon /> Add more PDFs or images</button>
          </div>
        )}

        {activeTool && activeTool !== "preview" && (
          <div className="file-panel tool-operation-panel">
            <div className="file-panel-title"><div><h3>{({ split: "Split PDF", rotate: "Rotate PDF", extract: "Extract Pages", compress: "Optimize PDF", "optimize-image": "Optimize Image" } as const)[activeTool]}</h3><span>{activeTool === "optimize-image" ? "Choose one image. Output is a compressed JPG; transparency is flattened to white." : "Choose the exact source file. Your original stays unchanged."}</span></div><button className="text-button" onClick={() => setActiveTool(null)}>Close</button></div>
            <label className="output-label" htmlFor="tool-source">SOURCE FILE</label><select id="tool-source" className="output-input" value={targetFileId} onChange={(event) => setTargetFileId(event.target.value)}>{items.filter((item) => activeTool === "optimize-image" ? /\.(jpe?g|png)$/i.test(item.file.name) : item.file.name.toLowerCase().endsWith(".pdf")).map((item) => <option key={item.id} value={item.id}>{item.file.name}</option>)}</select>
            {activeTool === "split" && <><label className="output-label" htmlFor="split-ranges">PAGE GROUPS (semicolon-separated)</label><input id="split-ranges" className="output-input" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="1-2;3-4;5"/><p className="demo-note">Example: 1-2;3-4 creates two PDFs. Use semicolons between output files and commas within a group (example: 1,3;2,4).</p></>}
            {activeTool === "extract" && <><label className="output-label" htmlFor="extract-ranges">PAGES TO KEEP</label><input id="extract-ranges" className="output-input" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="1-3,5"/><p className="demo-note">Use page numbers such as 1-3,5,8-9.</p></>}
            {activeTool === "rotate" && <><label className="output-label" htmlFor="rotate-degrees">ROTATION</label><select id="rotate-degrees" className="output-input" value={rotation} onChange={(event) => setRotation(Number(event.target.value) as 90 | 180 | 270)}><option value={90}>90° clockwise</option><option value={180}>180°</option><option value={270}>270° clockwise</option></select><label className="output-label" htmlFor="rotate-pages">PAGES (use all or a range)</label><input id="rotate-pages" className="output-input" value={pageRange} onChange={(event) => setPageRange(event.target.value)} placeholder="all or 1-3"/></>}
            {activeTool === "compress" && <><p className="demo-note">Rasterizes each page and recompresses it as JPEG. This can reduce file size, but text will no longer be selectable and links/forms may not be preserved.</p><label className="output-label" htmlFor="pdf-quality">IMAGE QUALITY · {imageQuality}%</label><input id="pdf-quality" className="output-input" type="range" min="35" max="92" step="1" value={imageQuality} onChange={(event) => setImageQuality(Number(event.target.value))}/></>}
            {activeTool === "optimize-image" && <><label className="output-label" htmlFor="image-quality">IMAGE QUALITY · {imageQuality}%</label><input id="image-quality" className="output-input" type="range" min="35" max="95" step="1" value={imageQuality} onChange={(event) => setImageQuality(Number(event.target.value))}/><p className="demo-note">Resizes images above 2400 pixels and exports a compressed JPG. PNG transparency becomes a white background.</p></>}
            <button className="button button-primary merge-button" disabled={busy || !items.some((item) => activeTool === "optimize-image" ? /\.(jpe?g|png)$/i.test(item.file.name) : item.file.name.toLowerCase().endsWith(".pdf"))} onClick={() => void runTool()}>{busy ? "Processing…" : activeTool === "compress" ? "Optimize PDF" : activeTool === "optimize-image" ? "Optimize Image" : activeTool === "rotate" ? "Rotate & Download" : activeTool === "extract" ? "Extract & Download" : "Split & Download"}</button>
          </div>
        )}

        <div className="merge-card">
          <div className="merge-card-top">
            <div className="merge-symbol"><MergeIcon /></div>
            <div className="merge-copy"><h3>Ready to bring it all together?</h3><p>Your original files will remain untouched.</p></div>
          </div>
          <label className="output-label" htmlFor="output-name">OUTPUT FILE NAME</label>
          <input id="output-name" className="output-input" value={outputName} onChange={(event) => { setOutputName(event.target.value); setOutputNameEdited(true); }} maxLength={100} />
          <div className="summary-line">
            <span>{items.length} files <i>·</i> {totalPages ? `${totalPages} pages detected` : "page count pending"}</span>
            <span>{formatBytes(totalSize)} total</span>
          </div>
          <button className="button button-primary merge-button" disabled={busy || items.length < 1} onClick={() => void merge()}>
            {busy ? <span className="spinner" /> : <MergeIcon />}
            {busy ? "Creating your PDF…" : "Create PDF"}
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
      <footer id="mobile-app"><span>© {new Date().getFullYear()} GattaiMate</span><span>Fast · Private · On-device processing</span><span>Made for documents that belong together.</span></footer>
      </main>
      {viewerItem && viewerUrl && (
        <div className="document-viewer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewerItem(null); }}>
          <section className="document-viewer" role="dialog" aria-modal="true" aria-label={`Preview ${viewerItem.file.name}`}>
            <header className="document-viewer-header">
              <div><strong>{viewerItem.file.name}</strong><small>{viewerItem.file.type || (viewerItem.file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image")}</small></div>
              <button className="viewer-close" aria-label="Close preview" onClick={() => setViewerItem(null)}>×</button>
            </header>
            <div className="document-viewer-stage">
              {viewerItem.file.name.toLowerCase().endsWith(".pdf") ? (
                <div className="viewer-canvas-wrap"><canvas ref={viewerCanvasRef} aria-label={`PDF page ${viewerPage}`} /></div>
              ) : (
                <img src={viewerUrl} alt={viewerItem.file.name} style={{ transform: `rotate(${viewerRotation}deg)` }} />
              )}
            </div>
            {viewerItem.file.name.toLowerCase().endsWith(".pdf") && (
              <div className="viewer-page-controls">
                <button className="button button-secondary" disabled={viewerPage <= 1} onClick={() => setViewerPage(page => page - 1)}>← Previous</button>
                <span>Page {viewerPage} of {viewerPageCount || "…"}</span>
                <button className="button button-secondary" disabled={!viewerPageCount || viewerPage >= viewerPageCount} onClick={() => setViewerPage(page => page + 1)}>Next →</button>
              </div>
            )}
            <footer className="document-viewer-controls">
              <div className="viewer-rotate-controls">
                <button className="button button-secondary" onClick={() => setViewerRotation(value => ((value + 270) % 360) as 0 | 90 | 180 | 270)}>↶ Rotate left</button>
                <button className="button button-secondary" onClick={() => setViewerRotation(value => ((value + 90) % 360) as 0 | 90 | 180 | 270)}>↻ Rotate right</button>
                <button className="button button-secondary" onClick={() => setViewerRotation(0)}>Reset</button>
              </div>
              <div className="viewer-save-controls">
                <button className="button button-secondary" onClick={() => setViewerItem(null)}>Close</button>
                <button className="button button-primary" disabled={busy || viewerRotation === 0} onClick={() => void saveViewerRotation()}>{busy ? "Saving…" : "Save rotated copy"}</button>
              </div>
              <p>Previewing does not download the file. Rotation is saved only when you choose “Save rotated copy”.</p>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function UploadIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3" /></svg>; }
function PlusIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>; }
function ShieldIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4" /></svg>; }
function FileIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5v5h4M8 13h8M8 16h8" /></svg>; }
function MergeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4a5 5 0 0 0 5 5h5M17 8l3 4-3 4M7 21v-4a5 5 0 0 1 5-5" /></svg>; }
