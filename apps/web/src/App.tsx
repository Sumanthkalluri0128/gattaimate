import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { useRoute } from "./router";
import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import { MenuIcon } from "./components/icons";
import HomePage from "./pages/HomePage";

// Everything except Home is code-split, so the first load stays small.
const MergePage = lazy(() => import("./pages/MergePage"));
const SplitPage = lazy(() => import("./pages/SplitPage"));
const ExtractPage = lazy(() => import("./pages/ExtractPage"));
const RotatePage = lazy(() => import("./pages/RotatePage"));
const OptimizePdfPage = lazy(() => import("./pages/OptimizePdfPage"));
const OptimizeImagePage = lazy(() => import("./pages/OptimizeImagePage"));
const RecentPage = lazy(() => import("./pages/RecentPage"));

const ROUTES: Record<string, { title: string; Page: ComponentType }> = {
  "/": { title: "Complete PDF Toolkit", Page: HomePage },
  "/merge": { title: "Merge PDF", Page: () => <MergePage mode="merge" /> },
  "/images-to-pdf": { title: "Images to PDF", Page: () => <MergePage mode="images" /> },
  "/split": { title: "Split PDF", Page: SplitPage },
  "/extract": { title: "Extract Pages", Page: ExtractPage },
  "/rotate": { title: "Rotate PDF", Page: RotatePage },
  "/optimize-pdf": { title: "Optimize PDF", Page: OptimizePdfPage },
  "/optimize-image": { title: "Optimize Image", Page: OptimizeImagePage },
  "/recent": { title: "Recent files", Page: RecentPage }
};

export default function App() {
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const match = ROUTES[route];

  useEffect(() => { document.title = `${match?.title ?? "Not found"} — GattaiMate`; }, [match]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="layout">
      <Sidebar route={route} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="content">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><MenuIcon /></button>
          <span className="topbar-title">{match?.title ?? "Not found"}</span>
          <span className="privacy-pill"><span className="dot" /> Private</span>
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
        <footer className="footer"><span>© {new Date().getFullYear()} GattaiMate</span><span>Fast · Private · On-device processing</span></footer>
      </div>
    </div>
  );
}
