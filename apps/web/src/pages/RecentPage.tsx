import { formatBytes } from "@gattaimate/pdf-core";
import { timeAgo, useRecent } from "../hooks/useRecent";
import { ClockIcon } from "../components/icons";

export default function RecentPage() {
  const { items, clear } = useRecent();
  return (
    <div className="page">
      <header className="page-header" style={{ "--accent": "#a998ff" } as React.CSSProperties}>
        <span className="page-header-icon"><ClockIcon size={24} /></span>
        <div><h1>Recent files</h1><p>A list of what you created on this device. Only names, sizes and times are saved — never the documents themselves.</p></div>
      </header>
      {items.length === 0 ? (
        <div className="empty"><ClockIcon size={22} /><div><strong>Nothing here yet</strong><small>Create a PDF with any tool and it will be listed here.</small></div></div>
      ) : (
        <section className="card">
          <div className="card-title"><div><h2>{items.length} recent</h2></div><button className="btn btn-ghost btn-sm" onClick={clear}>Clear history</button></div>
          <ul className="file-list">
            {items.map((item) => (
              <li className="file-row" key={item.id}>
                <span className="file-badge">{/\.zip$/i.test(item.name) ? "ZIP" : /\.(jpe?g|png)$/i.test(item.name) ? "IMG" : "PDF"}</span>
                <div className="file-info">
                  <div className="file-name" title={item.name}>{item.name}</div>
                  <div className="file-meta">{item.tool}{item.pages ? ` · ${item.pages} ${item.pages === 1 ? "page" : "pages"}` : ""} · {formatBytes(item.size)} · {timeAgo(item.at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
