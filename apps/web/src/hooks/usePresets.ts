import { useCallback, useState } from "react";
import type { Preset } from "@gattaimate/pdf-core";

const KEY = "gattaimate.presets.v1";

function load(): Preset[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/** Custom presets live in localStorage. Passwords are never stored — protect steps ask at run time. */
export function usePresets() {
  const [custom, setCustom] = useState<Preset[]>(load);
  const persist = (next: Preset[]) => { setCustom(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const add = useCallback((preset: Preset) => persist([...custom.filter((p) => p.id !== preset.id), preset]), [custom]);
  const remove = useCallback((id: string) => persist(custom.filter((p) => p.id !== id)), [custom]);
  return { custom, add, remove };
}
