import { useCallback, useEffect, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import type { Preset } from "@gattaimate/pdf-core";

const FILE = `${FileSystem.documentDirectory}presets.json`;

/** Custom presets saved on the device. Passwords are never stored — protect steps ask at run time. */
export function usePresets() {
  const [custom, setCustom] = useState<Preset[]>([]);
  useEffect(() => {
    FileSystem.readAsStringAsync(FILE).then((text) => { const parsed = JSON.parse(text); if (Array.isArray(parsed)) setCustom(parsed); }).catch(() => undefined);
  }, []);
  const persist = (next: Preset[]) => { setCustom(next); FileSystem.writeAsStringAsync(FILE, JSON.stringify(next)).catch(() => undefined); };
  const add = useCallback((preset: Preset) => persist([...custom.filter((p) => p.id !== preset.id), preset]), [custom]); // eslint-disable-line react-hooks/exhaustive-deps
  const remove = useCallback((id: string) => persist(custom.filter((p) => p.id !== id)), [custom]); // eslint-disable-line react-hooks/exhaustive-deps
  return { custom, add, remove };
}
