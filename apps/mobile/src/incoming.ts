import { isImageName, isPdfName } from "@gattaimate/pdf-core";
import type { Picked } from "./files";

/** Files handed to the app from outside (Android "Share → GattaiMate"), waiting for a tool to claim them. */
let pending: Picked[] = [];

export function setIncoming(files: Picked[]) {
  pending = files.filter((file) => isPdfName(file.name) || isImageName(file.name));
}
export const peekIncoming = () => pending;

/** Take (and clear) the waiting files that match `kind`. */
export function takeIncoming(kind: "pdf" | "image" | "any"): Picked[] {
  const match = pending.filter((file) => (kind === "any" ? true : kind === "pdf" ? isPdfName(file.name) : isImageName(file.name)));
  if (match.length) pending = pending.filter((file) => !match.includes(file));
  return match;
}
