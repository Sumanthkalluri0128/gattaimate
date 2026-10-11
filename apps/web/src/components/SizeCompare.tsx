import { formatBytes } from "@gattaimate/pdf-core";

/** Before/after file-size bars with the percentage saved. */
export default function SizeCompare({ before, after }: { before: number; after: number }) {
  const saved = Math.round((1 - after / before) * 100);
  const max = Math.max(before, after, 1);
  return (
    <div className="compare" aria-label={`Size changed from ${formatBytes(before)} to ${formatBytes(after)}`}>
      <div className="compare-row"><span>Before</span><div className="bar"><i style={{ width: `${(before / max) * 100}%` }} /></div><b>{formatBytes(before)}</b></div>
      <div className="compare-row"><span>After</span><div className="bar"><i className={saved > 0 ? "good" : "bad"} style={{ width: `${(after / max) * 100}%` }} /></div><b>{formatBytes(after)}</b></div>
      <p className={saved > 0 ? "good" : "muted"}>{saved > 0 ? `${saved}% smaller` : saved < 0 ? `${-saved}% larger` : "Same size"}</p>
    </div>
  );
}
