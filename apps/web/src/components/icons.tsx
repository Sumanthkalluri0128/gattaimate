import type { ReactNode } from "react";
import type { ToolId } from "../tools";

type IconProps = { size?: number };
const Svg = ({ children, size = 20 }: IconProps & { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);

export const HomeIcon = (p: IconProps) => <Svg {...p}><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z" /></Svg>;
export const ClockIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const UploadIcon = (p: IconProps) => <Svg {...p}><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3" /></Svg>;
export const PlusIcon = (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="m6 6 12 12M18 6 6 18" /></Svg>;
export const MenuIcon = (p: IconProps) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
export const ShieldIcon = (p: IconProps) => <Svg {...p}><path d="M12 3 19 6v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></Svg>;
export const FileIcon = (p: IconProps) => <Svg {...p}><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M14 3.5v5h4M8 13h8M8 16h8" /></Svg>;
export const ArrowUpIcon = (p: IconProps) => <Svg {...p}><path d="m6 14 6-6 6 6" /></Svg>;
export const ArrowDownIcon = (p: IconProps) => <Svg {...p}><path d="m6 10 6 6 6-6" /></Svg>;
export const RotateIcon = (p: IconProps) => <Svg {...p}><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" /></Svg>;
export const RotateLeftIcon = (p: IconProps) => <Svg {...p}><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5" /></Svg>;
export const SearchIcon = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></Svg>;
export const DragIcon = (p: IconProps) => <Svg {...p}><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth="2.6" /></Svg>;
export const AlertIcon = (p: IconProps) => <Svg {...p}><path d="M12 4 3 19.5h18L12 4Z" /><path d="M12 10v4.5M12 17.2v.01" /></Svg>;

const TOOL_ICONS: Record<ToolId, (p: IconProps) => ReactNode> = {
  merge: (p) => <Svg {...p}><path d="M7 3v4a5 5 0 0 0 5 5h5M17 8l3 4-3 4M7 21v-4a5 5 0 0 1 5-5" /></Svg>,
  images: (p) => <Svg {...p}><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 17 5-4.5 3.5 3L16 13l3 4" /></Svg>,
  split: (p) => <Svg {...p}><circle cx="6.5" cy="7" r="2.5" /><circle cx="6.5" cy="17" r="2.5" /><path d="M8.5 8.5 20 17M8.5 15.5 20 7" /></Svg>,
  extract: (p) => <Svg {...p}><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M9 14.5h6M12 11.5v6" /></Svg>,
  rotate: (p) => <Svg {...p}><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" /></Svg>,
  "optimize-pdf": (p) => <Svg {...p}><path d="M5 9V5h4M19 9V5h-4M5 15v4h4M19 15v4h-4" /><path d="M10 12h4" /></Svg>,
  "optimize-image": (p) => <Svg {...p}><path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></Svg>
};
export const ToolIcon = ({ id, size }: { id: ToolId } & IconProps) => <>{TOOL_ICONS[id]({ size })}</>;
