export type ToolId =
  | "merge" | "images" | "split" | "extract" | "rotate" | "organize"
  | "stamp" | "sign" | "forms" | "redact"
  | "optimize-pdf" | "optimize-image" | "to-images" | "protect" | "presets";

export type ToolGroup = "Create" | "Organize" | "Edit" | "Convert & secure" | "Automate";

export type ToolDef = { id: ToolId; path: string; title: string; blurb: string; color: string; group: ToolGroup };

/** Single source of truth for navigation, the home grid, and page headers. */
export const TOOLS: readonly ToolDef[] = [
  { id: "merge", path: "/merge", title: "Merge PDF", blurb: "Combine PDFs and images in any order", color: "#ff426e", group: "Create" },
  { id: "images", path: "/images-to-pdf", title: "Images to PDF", blurb: "Turn JPG and PNG photos into a PDF", color: "#149cff", group: "Create" },
  { id: "split", path: "/split", title: "Split PDF", blurb: "Break a document into several files", color: "#9a42ff", group: "Organize" },
  { id: "extract", path: "/extract", title: "Extract Pages", blurb: "Keep only the pages you need", color: "#ff9b43", group: "Organize" },
  { id: "rotate", path: "/rotate", title: "Rotate PDF", blurb: "Fix page orientation", color: "#18c995", group: "Organize" },
  { id: "organize", path: "/organize", title: "Organize Pages", blurb: "Drag, delete, duplicate and rotate pages", color: "#ffc233", group: "Organize" },
  { id: "stamp", path: "/stamp", title: "Numbers & Watermark", blurb: "Add page numbers or a text stamp", color: "#2fd0e8", group: "Edit" },
  { id: "sign", path: "/sign", title: "Sign PDF", blurb: "Draw, type or upload a signature", color: "#6f8bff", group: "Edit" },
  { id: "forms", path: "/forms", title: "Fill Form", blurb: "Fill in form fields and flatten", color: "#7be07b", group: "Edit" },
  { id: "redact", path: "/redact", title: "Redact", blurb: "Permanently black out sensitive areas", color: "#ff5f5f", group: "Edit" },
  { id: "optimize-pdf", path: "/optimize-pdf", title: "Optimize PDF", blurb: "Clean up or shrink a PDF", color: "#c15bff", group: "Convert & secure" },
  { id: "optimize-image", path: "/optimize-image", title: "Optimize Image", blurb: "Compress and resize JPG or PNG", color: "#ed49c4", group: "Convert & secure" },
  { id: "to-images", path: "/to-images", title: "PDF to Images", blurb: "Export every page as JPG or PNG", color: "#ffa07a", group: "Convert & secure" },
  { id: "protect", path: "/protect", title: "Protect / Unlock", blurb: "Add or remove a password", color: "#b0b8c8", group: "Convert & secure" },
  { id: "presets", path: "/presets", title: "Presets & Batch", blurb: "Run a recipe on many files at once", color: "#a3e635", group: "Automate" }
];

export const GROUPS: readonly ToolGroup[] = ["Create", "Organize", "Edit", "Convert & secure", "Automate"];

export const toolById = (id: ToolId) => TOOLS.find((tool) => tool.id === id)!;
