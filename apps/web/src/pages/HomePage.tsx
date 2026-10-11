import { useMemo, useState } from "react";
import { formatBytes } from "@gattaimate/pdf-core";
import { GROUPS, TOOLS, type ToolDef } from "../tools";
import { href } from "../router";
import { timeAgo, useRecent } from "../hooks/useRecent";
import { ClockIcon, SearchIcon, ShieldIcon, ToolIcon } from "../components/icons";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const { items } = useRecent();

  const tools = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? TOOLS.filter((tool) => `${tool.title} ${tool.blurb}`.toLowerCase().includes(needle)) : TOOLS;
  }, [query]);

  return (
    <div className="page page-wide">
      <section className="hero">
        <div>
          <span className="eyebrow">FAST · PRIVATE · OFFLINE</span>
          <h1>Complete <span>PDF</span> Toolkit</h1>
          <p>Merge, convert, split, rotate and compress documents. Everything runs on your device — no uploads, no account.</p>
          <div className="hero-actions">
            <a className="btn btn-primary" href={href("/merge")}>Start merging →</a>
            <a className="btn btn-secondary" href={href("/images-to-pdf")}>Photos to PDF</a>
          </div>
        </div>
        <div className="hero-private"><ShieldIcon size={30} /><strong>100% private</strong><small>Files never leave this device.</small></div>
      </section>

      <section aria-labelledby="tools-title">
        <div className="section-head">
          <div><span className="kicker">YOUR WORKSPACE</span><h2 id="tools-title">Everything for your documents</h2></div>
          <label className="search"><SearchIcon size={16} /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tools…  ( / )" aria-label="Search tools" /></label>
        </div>
        {tools.length ? (
          (query.trim() ? [["Results", tools] as const] : GROUPS.map((group) => [group, tools.filter((tool) => tool.group === group)] as const)).map(([group, list]) => (
            <div key={group} className="tool-group">
              <h3 className="group-title">{group}</h3>
              <div className="tool-grid">
                {(list as readonly ToolDef[]).map((tool) => (
                  <a key={tool.id} className="tool-card" href={href(tool.path)} style={{ "--accent": tool.color } as React.CSSProperties}>
                    <span className="tool-icon"><ToolIcon id={tool.id} size={22} /></span>
                    <strong>{tool.title}</strong>
                    <small>{tool.blurb}</small>
                  </a>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="empty"><SearchIcon size={22} /><div><strong>No tools match “{query}”</strong><small>Try “merge”, “sign” or “image”.</small></div></div>
        )}
      </section>

      <section aria-labelledby="recent-title">
        <div className="section-head">
          <div><span className="kicker">ON THIS DEVICE</span><h2 id="recent-title">Recent files</h2></div>
          {items.length > 0 && <a className="btn btn-ghost btn-sm" href={href("/recent")}>View all</a>}
        </div>
        {items.length ? (
          <div className="recent-grid">
            {items.slice(0, 4).map((item) => (
              <div className="recent-card" key={item.id}>
                <span className="file-badge">{/\.zip$/i.test(item.name) ? "ZIP" : /\.(jpe?g|png)$/i.test(item.name) ? "IMG" : "PDF"}</span>
                <div><strong title={item.name}>{item.name}</strong><small>{item.tool} · {formatBytes(item.size)} · {timeAgo(item.at)}</small></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty"><ClockIcon size={22} /><div><strong>No recent files yet</strong><small>Files you create appear here. Only names and sizes are remembered.</small></div></div>
        )}
      </section>
    </div>
  );
}
