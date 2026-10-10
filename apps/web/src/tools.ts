export type ToolId =
  | "merge" | "images" | "split" | "extract" | "rotate"
  | "optimize-pdf" | "optimize-image";

export type ToolDef = {
  id: ToolId;
  path: string;
  title: string;
  blurb: string;
  color: string;
};

/** Single source of truth for navigation, the home grid, and page headers. */
export const TOOLS: readonly ToolDef[] = [
  { id: "merge", path: "/merge", title: "Merge PDF", blurb: "Combine PDFs and images in any order", color: "#ff426e" },
  { id: "images", path: "/images-to-pdf", title: "Images to PDF", blurb: "Turn JPG and PNG photos into a PDF", color: "#149cff" },
  { id: "split", path: "/split", title: "Split PDF", blurb: "Break a document into several files", color: "#9a42ff" },
  { id: "extract", path: "/extract", title: "Extract Pages", blurb: "Keep only the pages you need", color: "#ff9b43" },
  { id: "rotate", path: "/rotate", title: "Rotate PDF", blurb: "Fix page orientation", color: "#18c995" },
  { id: "optimize-pdf", path: "/optimize-pdf", title: "Optimize PDF", blurb: "Clean up or shrink a PDF", color: "#c15bff" },
  { id: "optimize-image", path: "/optimize-image", title: "Optimize Image", blurb: "Compress and resize JPG or PNG", color: "#ed49c4" }
];

export const toolById = (id: ToolId) => TOOLS.find((tool) => tool.id === id)!;
