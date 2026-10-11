import { GROUPS, TOOLS } from "../tools";
import { href } from "../router";
import { ClockIcon, DownloadIcon, HomeIcon, ShieldIcon, ToolIcon } from "./icons";

type Props = { route: string; open: boolean; onNavigate: () => void; canInstall: boolean; onInstall: () => void };

export default function Sidebar({ route, open, onNavigate, canInstall, onInstall }: Props) {
  const link = (path: string, label: string, icon: React.ReactNode, color?: string) => (
    <a
      key={path}
      href={href(path)}
      className={`nav-link${route === path ? " active" : ""}`}
      aria-current={route === path ? "page" : undefined}
      style={color ? ({ "--accent": color } as React.CSSProperties) : undefined}
      onClick={onNavigate}
    >
      {icon}<span>{label}</span>
    </a>
  );

  return (
    <aside className={`sidebar${open ? " open" : ""}`} aria-label="Main navigation">
      <a className="brand" href={href("/")} onClick={onNavigate} aria-label="GattaiMate home">
        <img src="/gattaimate-icon.svg" alt="" width="38" height="38" />
        <span><b>Gattai<em>Mate</em></b><small>All your documents. One app.</small></span>
      </a>
      <nav>
        {link("/", "Home", <HomeIcon />)}
        {GROUPS.map((group) => (
          <div key={group} role="group" aria-label={group}>
            <div className="nav-label">{group}</div>
            {TOOLS.filter((tool) => tool.group === group).map((tool) => link(tool.path, tool.title, <ToolIcon id={tool.id} />, tool.color))}
          </div>
        ))}
        <div className="nav-label">Library</div>
        {link("/recent", "Recent files", <ClockIcon />)}
      </nav>
      {canInstall && <button className="btn btn-secondary btn-sm install" onClick={onInstall}><DownloadIcon size={16} /> Install app</button>}
      <div className="sidebar-private">
        <ShieldIcon size={18} />
        <div><strong>100% private</strong><small>Files stay on your device. Nothing is uploaded.</small></div>
      </div>
    </aside>
  );
}
