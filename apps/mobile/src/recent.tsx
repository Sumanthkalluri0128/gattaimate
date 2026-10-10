import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as FileSystem from "expo-file-system/legacy";

export type RecentItem = { id: string; name: string; tool: string; pages?: number; size: number; at: number };

const FILE = `${FileSystem.documentDirectory}recent.json`;
const LIMIT = 12;

type Ctx = { items: RecentItem[]; add: (item: Omit<RecentItem, "id" | "at">) => void; clear: () => void };
const Context = createContext<Ctx | null>(null);

const persist = (items: RecentItem[]) =>
  FileSystem.writeAsStringAsync(FILE, JSON.stringify(items)).catch(() => undefined);

/** Names, sizes and times only — never document contents. */
export function RecentProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    FileSystem.readAsStringAsync(FILE)
      .then((text) => { const parsed = JSON.parse(text); if (Array.isArray(parsed)) setItems(parsed.slice(0, LIMIT)); })
      .catch(() => undefined);
  }, []);

  const add = useCallback((item: Omit<RecentItem, "id" | "at">) => {
    setItems((current) => {
      const next = [{ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, at: Date.now() }, ...current].slice(0, LIMIT);
      void persist(next);
      return next;
    });
  }, []);
  const clear = useCallback(() => { setItems([]); void persist([]); }, []);

  const value = useMemo(() => ({ items, add, clear }), [items, add, clear]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRecent(): Ctx {
  const value = useContext(Context);
  if (!value) throw new Error("useRecent must be used inside <RecentProvider>");
  return value;
}

export function timeAgo(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(at).toLocaleDateString();
}
