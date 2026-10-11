import { useEffect, useMemo, useRef, useState } from "react";
import { baseName, organizePdf, withExtension, type PagePlan } from "@gattaimate/pdf-core";
import SingleFileTool from "../components/SingleFileTool";
import { ArrowDownIcon, ArrowUpIcon, RotateIcon, RotateLeftIcon } from "../components/icons";
import { downloadBytes } from "../lib/browser";
import { usePdfThumbnails } from "../lib/thumbnails";

type Tile = { id: number; page: number; rotation: number; removed: boolean };

function Editor({ file, count, onPlan }: { file: File; count: number; onPlan: (plan: PagePlan[]) => void }) {
  const { thumbs, error } = usePdfThumbnails(file);
  const nextId = useRef(count);
  const [tiles, setTiles] = useState<Tile[]>(() => Array.from({ length: count }, (_, i) => ({ id: i, page: i, rotation: 0, removed: false })));
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const kept = useMemo(() => tiles.filter((tile) => !tile.removed), [tiles]);
  useEffect(() => { onPlan(kept.map((tile) => ({ page: tile.page, rotation: tile.rotation }))); }, [kept, onPlan]);

  const patch = (id: number, change: Partial<Tile>) => setTiles((current) => current.map((tile) => (tile.id === id ? { ...tile, ...change } : tile)));
  const move = (from: number, to: number) => setTiles((current) => {
    if (from === to || to < 0 || to >= current.length) return current;
    const next = [...current];
    next.splice(to, 0, next.splice(from, 1)[0]);
    return next;
  });
  const duplicate = (index: number) => setTiles((current) => {
    const next = [...current];
    next.splice(index + 1, 0, { ...current[index], id: nextId.current++, removed: false });
    return next;
  });
  const reset = () => setTiles(Array.from({ length: count }, (_, i) => ({ id: i, page: i, rotation: 0, removed: false })));

  return (
    <>
      <div className="card-title">
        <small>{kept.length} of {tiles.length} pages kept · drag tiles to reorder</small>
        <button className="btn btn-ghost btn-sm" onClick={reset}>Reset</button>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <ol className="tile-grid">
        {tiles.map((tile, index) => (
          <li key={tile.id}
            className={`tile${tile.removed ? " removed" : ""}${dragFrom === index ? " dragging" : ""}${over === index && dragFrom !== index ? " drop-target" : ""}`}
            draggable
            onDragStart={(e) => { setDragFrom(index); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(index)); }}
            onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setOver(index); } }}
            onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) move(dragFrom, index); setDragFrom(null); setOver(null); }}
            onDragEnd={() => { setDragFrom(null); setOver(null); }}>
            <div className="tile-thumb">
              {thumbs.get(tile.page) ? <img src={thumbs.get(tile.page)} alt={`Page ${tile.page + 1}`} draggable={false} style={{ transform: `rotate(${tile.rotation}deg)` }} /> : <span className="spinner" />}
            </div>
            <div className="tile-label">{tile.removed ? "Removed" : `Page ${tile.page + 1}`}{tile.rotation ? ` · ↻${tile.rotation}°` : ""}</div>
            <div className="tile-actions">
              <button className="icon-button" aria-label={`Rotate page ${tile.page + 1} left`} onClick={() => patch(tile.id, { rotation: (tile.rotation + 270) % 360 })}><RotateLeftIcon size={14} /></button>
              <button className="icon-button" aria-label={`Rotate page ${tile.page + 1} right`} onClick={() => patch(tile.id, { rotation: (tile.rotation + 90) % 360 })}><RotateIcon size={14} /></button>
              <button className="icon-button" aria-label="Move earlier" disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUpIcon size={14} /></button>
              <button className="icon-button" aria-label="Move later" disabled={index === tiles.length - 1} onClick={() => move(index, index + 1)}><ArrowDownIcon size={14} /></button>
              <button className="icon-button" aria-label={`Duplicate page ${tile.page + 1}`} title="Duplicate" onClick={() => duplicate(index)}>⧉</button>
              <button className={`icon-button${tile.removed ? "" : " danger"}`} aria-label={tile.removed ? "Restore page" : `Delete page ${tile.page + 1}`} onClick={() => patch(tile.id, { removed: !tile.removed })}>{tile.removed ? "↺" : "×"}</button>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

export default function OrganizePage() {
  const plan = useRef<PagePlan[]>([]);
  return (
    <SingleFileTool
      id="organize"
      accept="pdf"
      actionLabel="Save organized PDF"
      options={({ file, pageCount }) => pageCount ? <Editor key={`${file.name}-${file.size}-${file.lastModified}`} file={file} count={pageCount} onPlan={(p) => { plan.current = p; }} /> : null}
      run={async ({ file, bytes }) => {
        const out = await organizePdf(await bytes(), plan.current);
        const name = withExtension(`${baseName(file.name)}-organized`, ".pdf");
        const size = downloadBytes(out.bytes, name);
        return { message: `Saved ${name} with ${out.pageCount} page${out.pageCount === 1 ? "" : "s"}.`, name, size, pages: out.pageCount };
      }}
    />
  );
}
