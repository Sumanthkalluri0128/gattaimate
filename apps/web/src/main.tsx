import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { RecentProvider } from "./hooks/useRecent";
import { registerSW } from "virtual:pwa-register";
import "./styles.css";

// Cache the app for offline use; new versions install in the background.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RecentProvider>
      <App />
    </RecentProvider>
  </StrictMode>
);
