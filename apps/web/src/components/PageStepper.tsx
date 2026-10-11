export default function PageStepper({ page, count, onChange }: { page: number; count: number; onChange: (page: number) => void }) {
  return (
    <div className="viewer-group" aria-label="Page selection">
      <button className="btn btn-secondary btn-sm" disabled={page <= 0} onClick={() => onChange(page - 1)}>← Prev</button>
      <span className="viewer-status">Page {page + 1} of {count || "…"}</span>
      <button className="btn btn-secondary btn-sm" disabled={!count || page >= count - 1} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  );
}
