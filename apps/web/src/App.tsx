import { lazy, Suspense, useCallback, useEffect, useState, type ComponentType } from "react";
import { useRoute } from "./router";
import { useTheme } from "./hooks/useTheme";
import { useShortcuts } from "./hooks/useShortcuts";
import { usePwa } from "./hooks/usePwa";
import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import Modal from "./components/Modal";
import { KeyboardIcon, MenuIcon, MoonIcon, SunIcon } from "./components/icons";
import HomePage from "./pages/HomePage";

// Everything except Home is code-split, so the first load stays small.
const page = <T extends ComponentType<any>>(load: () => Promise<{ default: T }>) => lazy(load);
const MergePage = page(() => import("./pages/MergePage"));
const SplitPage = page(() => import("./pages/SplitPage"));
const ExtractPage = page(() => import("./pages/ExtractPage"));
const RotatePage = page(() => import("./pages/RotatePage"));
const OrganizePage = page(() => import("./pages/OrganizePage"));
const SignPage = page(() => import("./pages/SignPage"));
const FormsPage = page(() => import("./pages/FormsPage"));
const RedactPage = page(() => import("./pages/RedactPage"));
const OptimizePdfPage = page(() => import("./pages/OptimizePdfPage"));
const OptimizeImagePage = page(() => import("./pages/OptimizeImagePage"));
const ToImagesPage = page(() => import("./pages/ToImagesPage"));
const ProtectPage = page(() => import("./pages/ProtectPage"));
const PresetsPage = page(() => import("./pages/PresetsPage"));
const RecentPage = page(() => import("./pages/RecentPage"));

const ROUTES: Record<string, { title: string; Page: ComponentType }> = {
  "/": { title: "Complete PDF Toolkit", Page: HomePage },
  "/merge": { title: "Merge PDF", Page: () => <MergePage mode="merge" /> },
  "/images-to-pdf": { title: "Images to PDF", Page: () => <MergePage mode="images" /> },
  "/split": { title: "Split PDF", Page: SplitPage },
  "/extract": { title: "Extract Pages", Page: ExtractPage },
  "/rotate": { title: "Rotate PDF", Page: RotatePage },
  "/organize": { title: "Organize Pages", Page: OrganizePage },
  "/sign": { title: "Sign PDF", Page: SignPage },
  "/forms": { title: "Fill Form", Page: FormsPage },
  "/redact": { title: "Redact", Page: RedactPage },
  "/optimize-pdf": { title: "Optimize PDF", Page: OptimizePdfPage },
  "/optimize-image": { title: "Optimize Image", Page: OptimizeImagePage },
  "/to-images": { title: "PDF to Images", Page: ToImagesPage },
  "/protect": { title: "Protect / Unlock", Page: ProtectPage },
  "/presets": { title: "Presets & Batch", Page: PresetsPage },
  "/recent": { title: "Recent files", Page: RecentPage }
};

const SHORTCUTS: [string, string][] = [
  ["Ctrl / ⌘ + O", "Choose a file"],
  ["Ctrl / ⌘ + Enter", "Run the main action"],
  ["/", "Search tools (Home)"],
  ["Esc", "Close a dialog or menu"],
  ["?", "Show this list"]
];

export default function App() {
  const route = useRoute();
  const { theme, toggle } = useTheme();
  const { canInstall, install, online } = usePwa();
  const [menuOpen, setMenuOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const match = ROUTES[route];
  const openHelp = useCallback(() => setHelp(true), []);
  const closeHelp = useCallback(() => setHelp(false), []);
  useShortcuts(openHelp);

  useEffect(() => { document.title = `${match?.title ?? "Not found"} — GattaiMate`; }, [match]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="layout">
      <Sidebar route={route} open={menuOpen} onNavigate={() => setMenuOpen(false)} canInstall={canInstall} onInstall={() => void install()} />
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="content">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><MenuIcon /></button>
          <span className="topbar-title">{match?.title ?? "Not found"}</span>
          <button className="icon-button hide-touch" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={openHelp}><KeyboardIcon size={18} /></button>
          <button className="icon-button" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme" onClick={toggle}>{theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}</button>
          <span className="privacy-pill"><span className={`dot${online ? "" : " offline"}`} /> {online ? "Private" : "Offline"}</span>
        </header>
        <main id="main">
          <ErrorBoundary resetKey={route}>
            <Suspense fallback={<div className="page"><div className="loading"><span className="spinner" /> Loading…</div></div>}>
              {match ? <match.Page /> : (
                <div className="page"><div className="empty"><div><strong>Page not found</strong><small><a href="#/">Go back home</a></small></div></div></div>
              )}
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="footer"><span>© {new Date().getFullYear()} GattaiMate</span><span>Fast · Private · Works offline once installed</span></footer>
      </div>
      {help && (
        <Modal title="Keyboard shortcuts" onClose={closeHelp}>
          <ul className="shortcuts">{SHORTCUTS.map(([keys, what]) => <li key={keys}><kbd>{keys}</kbd><span>{what}</span></li>)}</ul>
        </Modal>
      )}
    </div>
  );
}
