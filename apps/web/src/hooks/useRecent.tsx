import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { newId } from "../lib/browser";

export type RecentItem = { id: string; name: string; tool: string; pages?: number; size: number; at: number };

const KEY = "gattaimate.recent.v1";
const LIMIT = 12;

function load(): RecentItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}
function save(items: RecentItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage may be unavailable (private mode) */ }
}

type RecentContext = { items: RecentItem[]; add: (item: Omit<RecentItem, "id" | "at">) => void; clear: () => void };
const Context = createContext<RecentContext | null>(null);

/** Only names, sizes and timestamps are remembered — never document contents. */
export function RecentProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<RecentItem[]>(load);

  const add = useCallback((item: Omit<RecentItem, "id" | "at">) => {
    setItems((current) => {
      const next = [{ ...item, id: newId(), at: Date.now() }, ...current].slice(0, LIMIT);
      save(next);
      return next;
    });
  }, []);
  const clear = useCallback(() => { setItems([]); save([]); }, []);

  const value = useMemo(() => ({ items, add, clear }), [items, add, clear]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRecent(): RecentContext {
  const value = useContext(Context);
  if (!value) throw new Error("useRecent must be used inside <RecentProvider>");
  return value;
}

export function timeAgo(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(at).toLocaleDateString();
}
