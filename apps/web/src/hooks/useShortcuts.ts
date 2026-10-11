import { useEffect } from "react";

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** App-wide keyboard shortcuts (desktop). */
export function useShortcuts(onHelp: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "o") {
        const input = document.querySelector<HTMLInputElement>(".dropzone input[type=file]");
        if (input) { event.preventDefault(); input.click(); }
      } else if (mod && event.key === "Enter") {
        const button = document.querySelector<HTMLButtonElement>("[data-primary]:not(:disabled)");
        if (button) { event.preventDefault(); button.click(); }
      } else if (!mod && !typing(event.target)) {
        if (event.key === "/") {
          const search = document.querySelector<HTMLInputElement>("input[aria-label='Search tools']");
          if (search) { event.preventDefault(); search.focus(); }
        } else if (event.key === "?") {
          event.preventDefault();
          onHelp();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onHelp]);
}
