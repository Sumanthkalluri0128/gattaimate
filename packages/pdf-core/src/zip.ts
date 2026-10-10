import { zipSync } from "fflate";

export type NamedBytes = { name: string; bytes: Uint8Array };

/** Bundle several files into one ZIP (stored, since PDFs are already compressed). Duplicate names get a numeric suffix. */
export function zipFiles(files: NamedBytes[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const file of files) {
    let name = file.name;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = file.name.replace(/(\.[^.]*)?$/, ` (${n})$1`);
    used.add(name.toLowerCase());
    entries[name] = file.bytes;
  }
  return zipSync(entries, { level: 0 });
}
