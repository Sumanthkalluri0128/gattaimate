import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

type Props = { title: string; onClose: () => void; children: ReactNode };

export default function Modal({ title, onClose, children }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <strong title={title}>{title}</strong>
          <button ref={closeButton} className="icon-button" aria-label="Close preview" onClick={onClose}><CloseIcon size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
