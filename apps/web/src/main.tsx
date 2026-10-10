import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { RecentProvider } from "./hooks/useRecent";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RecentProvider>
      <App />
    </RecentProvider>
  </StrictMode>
);
