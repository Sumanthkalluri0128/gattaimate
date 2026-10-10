import { toolById, type ToolId } from "../tools";
import { ToolIcon } from "./icons";

export default function PageHeader({ id, title, blurb }: { id: ToolId; title?: string; blurb?: string }) {
  const tool = toolById(id);
  return (
    <header className="page-header" style={{ "--accent": tool.color } as React.CSSProperties}>
      <span className="page-header-icon"><ToolIcon id={id} size={24} /></span>
      <div><h1>{title ?? tool.title}</h1><p>{blurb ?? tool.blurb}</p></div>
    </header>
  );
}
