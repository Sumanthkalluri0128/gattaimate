export type ToolId =
  | "merge" | "images" | "scan" | "split" | "extract" | "rotate" | "organize"
  | "sign" | "forms" | "optimize-pdf" | "optimize-image" | "protect" | "presets";

export type ToolDef = { id: ToolId; title: string; blurb: string; color: string; glyph: string };

/** Single source of truth for the home grid and screen titles. */
export const TOOLS: readonly ToolDef[] = [
  { id: "scan", title: "Scan to PDF", blurb: "Camera pages into a PDF", color: "#2FD0E8", glyph: "◎" },
  { id: "merge", title: "Merge PDF", blurb: "Combine PDFs and images", color: "#FF477E", glyph: "⇉" },
  { id: "images", title: "Images to PDF", blurb: "JPG & PNG into a PDF", color: "#279BFF", glyph: "▣" },
  { id: "split", title: "Split PDF", blurb: "Break into several files", color: "#A75BFF", glyph: "✂" },
  { id: "extract", title: "Extract Pages", blurb: "Keep only what you need", color: "#FF9B43", glyph: "⎘" },
  { id: "rotate", title: "Rotate PDF", blurb: "Fix page orientation", color: "#18C995", glyph: "⟳" },
  { id: "organize", title: "Organize Pages", blurb: "Reorder, delete, duplicate", color: "#FFC233", glyph: "☰" },
  { id: "sign", title: "Sign PDF", blurb: "Type or upload a signature", color: "#6F8BFF", glyph: "✍" },
  { id: "forms", title: "Fill Form", blurb: "Fill in form fields", color: "#7BE07B", glyph: "☑" },
  { id: "optimize-pdf", title: "Optimize PDF", blurb: "Clean up a PDF", color: "#C15BFF", glyph: "⤢" },
  { id: "optimize-image", title: "Optimize Image", blurb: "Compress & resize", color: "#ED49C4", glyph: "✦" },
  { id: "protect", title: "Protect PDF", blurb: "Add a password", color: "#B0B8C8", glyph: "🔒" },
  { id: "presets", title: "Presets & Batch", blurb: "One recipe, many files", color: "#A3E635", glyph: "⚡" }
];

export const toolById = (id: string) => TOOLS.find((tool) => tool.id === id);
