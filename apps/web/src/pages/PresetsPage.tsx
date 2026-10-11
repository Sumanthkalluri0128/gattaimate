import { useState } from "react";
import { BUILT_IN_PRESETS, describeStep, formatBytes, runPipeline, baseName, withExtension, zipFiles, type NamedBytes, type PipelineStep, type Preset } from "@gattaimate/pdf-core";
import Dropzone from "../components/Dropzone";
import Notice, { type NoticeState } from "../components/Notice";
import PageHeader from "../components/PageHeader";
import { downloadBytes, errorMessage, isPdfFile, looksEncrypted, newId, readBytes } from "../lib/browser";
import { usePresets } from "../hooks/usePresets";
import { useRecent } from "../hooks/useRecent";

type Entry = { id: string; file: File };

const shrink = async (bytes: Uint8Array, quality: number) => {
  const { rasterizePdf } = await import("../lib/rasterize");
  const out = await rasterizePdf(new File([bytes as BlobPart], "in.pdf", { type: "application/pdf" }), { quality });
  return out.bytes.byteLength < bytes.byteLength ? out.bytes : bytes; // never make a file bigger
};

function Builder({ onSave }: { onSave: (preset: Preset) => void }) {
  const [name, setName] = useState("");
  const [useShrink, setShrink] = useState(false);
  const [quality, setQuality] = useState(60);
  const [clean, setClean] = useState(true);
  const [rotate, setRotate] = useState(false);
  const [angle, setAngle] = useState(90);
  const [lock, setLock] = useState(false);
  const [error, setError] = useState("");

  function save() {
    const steps: PipelineStep[] = [];
    if (useShrink) steps.push({ op: "shrink", quality });
    if (clean) steps.push({ op: "optimize" });
    if (rotate) steps.push({ op: "rotate", angle });
    if (lock) steps.push({ op: "protect", password: "" });
    if (!name.trim()) return setError("Give the preset a name.");
    if (steps.length === 0) return setError("Pick at least one step.");
    setError("");
    onSave({ id: `custom-${newId()}`, name: name.trim(), description: steps.map(describeStep).join(" → "), steps });
    setName("");
  }

  return (
    <div className="builder">
      <div className="field"><label htmlFor="pname">Preset name</label><input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly invoices" maxLength={40} autoComplete="off" /></div>
      <label className="check"><input type="checkbox" checked={useShrink} onChange={(e) => setShrink(e.target.checked)} /> Shrink file size (web only)</label>
      {useShrink && <div className="field"><label htmlFor="pq">Quality · {quality}%</label><input id="pq" type="range" min={35} max={90} value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></div>}
      <label className="check"><input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} /> Optimize & clear metadata</label>
      <label className="check"><input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} /> Rotate all pages</label>
      {rotate && <select aria-label="Rotation" value={angle} onChange={(e) => setAngle(Number(e.target.value))}><option value={90}>90° right</option><option value={180}>180°</option><option value={270}>90° left</option></select>}
      <label className="check"><input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} /> Password-protect (asked each time you run)</label>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <button className="btn btn-secondary" onClick={save}>Save preset</button>
    </div>
  );
}

export default function PresetsPage() {
  const recent = useRecent();
  const { custom, add, remove } = usePresets();
  const presets: Preset[] = [...BUILT_IN_PRESETS, ...custom];
  const [selectedId, setSelectedId] = useState(BUILT_IN_PRESETS[0].id);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [password, setPassword] = useState("");
  const [openPassword, setOpenPassword] = useState("");
  const [building, setBuilding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);

  const preset = presets.find((p) => p.id === selectedId) ?? presets[0];
  const needsPassword = preset.steps.some((s) => s.op === "protect");

  function addFiles(files: File[]) {
    const pdfs = files.filter(isPdfFile);
    setNotice(pdfs.length < files.length ? { kind: "info", text: `Skipped ${files.length - pdfs.length} non-PDF file(s).` } : null);
    setEntries((current) => [...current, ...pdfs.map((file) => ({ id: newId(), file }))]);
  }

  async function run() {
    if (busy || entries.length === 0) return;
    if (needsPassword && password.length < 4) { setNotice({ kind: "error", text: "Enter a password of at least 4 characters for this preset." }); return; }
    setBusy(true);
    setNotice(null);
    const steps = preset.steps.map((s) => (s.op === "protect" ? { ...s, password } : s));
    const outputs: NamedBytes[] = [];
    const failures: string[] = [];
    const notes = new Set<string>();
    let pages = 0;
    for (const [index, entry] of entries.entries()) {
      setStatus(`File ${index + 1} of ${entries.length}: ${entry.file.name}`);
      try {
        let data = await readBytes(entry.file);
        if (looksEncrypted(data)) {
          // Locked PDF: try the password above (or none, for restriction-only files).
          const { unlockPdf } = await import("../lib/qpdf");
          try { data = await unlockPdf(data, openPassword); }
          catch { throw new Error(openPassword ? "the password above doesn't open this file" : "it is password-protected — enter its password above"); }
        }
        const result = await runPipeline(data, steps, { shrink });
        result.notes.forEach((n) => notes.add(n));
        pages += result.pageCount;
        outputs.push({ name: withExtension(`${baseName(entry.file.name)}-${preset.id.startsWith("custom") ? "processed" : preset.id}`, ".pdf"), bytes: result.bytes });
      } catch (error) {
        failures.push(`${entry.file.name}: ${errorMessage(error, "failed")}`);
      }
    }
    try {
      if (outputs.length === 0) throw new Error(failures[0] ?? "Nothing was produced.");
      const single = outputs.length === 1;
      const name = single ? outputs[0].name : "gattaimate-batch.zip";
      const size = single ? downloadBytes(outputs[0].bytes, name) : downloadBytes(zipFiles(outputs), name, "application/zip");
      recent.add({ name, tool: `Preset · ${preset.name}`, pages, size });
      const extra = [...notes, ...failures.map((f) => `Failed — ${f}`)];
      setNotice({ kind: failures.length ? "info" : "success", text: `“${preset.name}” processed ${outputs.length} of ${entries.length} file${entries.length === 1 ? "" : "s"} → ${name} (${formatBytes(size)}).${extra.length ? ` ${extra.join(" ")}` : ""}` });
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error, "The batch failed.") });
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="page">
      <PageHeader id="presets" blurb="Pick a recipe, add one or many PDFs, and get the results in one go — a single file, or a ZIP for many." />
      <section className="card" aria-label="Presets">
        <div className="card-title"><div><h2>1 · Choose a preset</h2></div><button className="btn btn-ghost btn-sm" onClick={() => setBuilding((v) => !v)}>{building ? "Close" : "+ New preset"}</button></div>
        {building && <Builder onSave={(p) => { add(p); setSelectedId(p.id); setBuilding(false); }} />}
        <div className="preset-list" role="radiogroup" aria-label="Preset">
          {presets.map((p) => (
            <label key={p.id} className={`preset${p.id === preset.id ? " on" : ""}`}>
              <input type="radio" name="preset" checked={p.id === preset.id} onChange={() => setSelectedId(p.id)} />
              <div><strong>{p.name}</strong><small>{p.description}</small></div>
              {!p.builtIn && <button className="icon-button danger" aria-label={`Delete preset ${p.name}`} onClick={(e) => { e.preventDefault(); remove(p.id); if (selectedId === p.id) setSelectedId(BUILT_IN_PRESETS[0].id); }}>×</button>}
            </label>
          ))}
        </div>
        <small className="hint">Steps: {preset.steps.map(describeStep).join(" → ")}</small>
      </section>

      <Dropzone accept="application/pdf,.pdf" multiple compact={entries.length > 0} title="Drop PDFs here" hint="Add as many as you like" buttonLabel={entries.length ? "Add more PDFs" : "Choose PDFs"} onFiles={addFiles} />

      {entries.length > 0 && (
        <section className="card">
          <div className="card-title"><div><h2>2 · {entries.length} file{entries.length === 1 ? "" : "s"}</h2></div><button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEntries([])}>Clear all</button></div>
          <ul className="file-list">
            {entries.map((entry) => (
              <li className="file-row" key={entry.id}>
                <span className="file-badge">PDF</span>
                <div className="file-info"><div className="file-name" title={entry.file.name}>{entry.file.name}</div><div className="file-meta">{formatBytes(entry.file.size)}</div></div>
                <button className="icon-button danger" aria-label={`Remove ${entry.file.name}`} disabled={busy} onClick={() => setEntries((c) => c.filter((x) => x.id !== entry.id))}>×</button>
              </li>
            ))}
          </ul>
          <div className="field"><label htmlFor="open-pw">Password for locked PDFs (optional)</label>
            <input id="open-pw" type="password" value={openPassword} onChange={(e) => setOpenPassword(e.target.value)} autoComplete="off" />
            <small>If some files are password-protected, enter their password and they are opened automatically. Files that only have editing restrictions need no password.</small></div>
          {needsPassword && <div className="field"><label htmlFor="batch-pw">Password for the protected copies</label><input id="batch-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>}
          <button className="btn btn-primary btn-block" data-primary disabled={busy} onClick={() => void run()}>{busy ? <span className="spinner" /> : null}{busy ? status || "Working…" : `Run “${preset.name}”`}</button>
        </section>
      )}
      <Notice notice={notice} />
    </div>
  );
}
