import { addPageNumbers, addWatermark, protectPdf, type NumberPosition } from "./edit";
import { extractPdfPages, getPdfPageCount, optimizePdf, rotatePdfPages, type MergeResult } from "./pdf";

export type PipelineStep =
  | { op: "optimize" }
  | { op: "shrink"; quality: number }
  | { op: "rotate"; angle: number; pages?: string }
  | { op: "extract"; pages: string }
  | { op: "numbers"; position?: NumberPosition; format?: string }
  | { op: "watermark"; text: string }
  | { op: "protect"; password: string };

export type Preset = { id: string; name: string; description: string; steps: PipelineStep[]; builtIn?: boolean };

/** Optional environment-specific helpers. `shrink` needs a canvas, so only the web app supplies it. */
export type PipelineHooks = { shrink?: (bytes: Uint8Array, quality: number) => Promise<Uint8Array> };
export type PipelineResult = MergeResult & { notes: string[] };

export const BUILT_IN_PRESETS: readonly Preset[] = [
  { id: "email", name: "Email-ready", description: "Shrink to the smallest size that still reads well (web), then clean metadata.", builtIn: true, steps: [{ op: "shrink", quality: 55 }, { op: "optimize" }] },
  { id: "clean", name: "Privacy clean-up", description: "Remove title/author metadata and rewrite the file efficiently.", builtIn: true, steps: [{ op: "optimize" }] },
  { id: "numbered", name: "Numbered copy", description: "Add “Page 1 of N” at the bottom of every page.", builtIn: true, steps: [{ op: "numbers", position: "bottom-center", format: "Page {n} of {total}" }] },
  { id: "confidential", name: "Confidential draft", description: "Diagonal CONFIDENTIAL watermark plus page numbers.", builtIn: true, steps: [{ op: "watermark", text: "CONFIDENTIAL" }, { op: "numbers", position: "bottom-right", format: "{n}" }] }
];

export function describeStep(step: PipelineStep): string {
  switch (step.op) {
    case "optimize": return "Optimize & clear metadata";
    case "shrink": return `Shrink file (quality ${step.quality}%)`;
    case "rotate": return `Rotate ${step.angle}°${step.pages ? ` (pages ${step.pages})` : ""}`;
    case "extract": return `Keep pages ${step.pages}`;
    case "numbers": return `Page numbers (${step.format ?? "{n}"})`;
    case "watermark": return `Watermark “${step.text}”`;
    case "protect": return "Password-protect";
  }
}

/** Apply steps in order. Protection always runs last because a protected PDF can't be edited further. */
export async function runPipeline(input: Uint8Array, steps: PipelineStep[], hooks: PipelineHooks = {}): Promise<PipelineResult> {
  if (steps.length === 0) throw new Error("This preset has no steps.");
  const ordered = [...steps.filter((step) => step.op !== "protect"), ...steps.filter((step) => step.op === "protect")];
  let bytes = input;
  const notes: string[] = [];
  for (const step of ordered) {
    switch (step.op) {
      case "optimize": bytes = (await optimizePdf(bytes)).bytes; break;
      case "rotate": bytes = (await rotatePdfPages(bytes, step.angle, step.pages || "all")).bytes; break;
      case "extract": bytes = (await extractPdfPages(bytes, step.pages)).bytes; break;
      case "numbers": bytes = (await addPageNumbers(bytes, { position: step.position, format: step.format })).bytes; break;
      case "watermark": bytes = (await addWatermark(bytes, { text: step.text })).bytes; break;
      case "shrink":
        if (!hooks.shrink) { notes.push("“Shrink” needs the web app, so it was skipped."); break; }
        bytes = await hooks.shrink(bytes, step.quality);
        break;
      case "protect": {
        const pageCount = await getPdfPageCount(bytes);
        return { bytes: await protectPdf(bytes, step.password), pageCount, notes };
      }
    }
  }
  return { bytes, pageCount: await getPdfPageCount(bytes), notes };
}
