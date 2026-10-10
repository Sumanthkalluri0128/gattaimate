import { useRef, useState } from "react";
import { PlusIcon, ShieldIcon, UploadIcon } from "./icons";

type Props = {
  accept: string;
  multiple?: boolean;
  title: string;
  hint: string;
  buttonLabel: string;
  compact?: boolean;
  onFiles: (files: File[]) => void;
};

export default function Dropzone({ accept, multiple = false, title, hint, buttonLabel, compact, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);

  return (
    <div
      className={`dropzone${active ? " active" : ""}${compact ? " compact" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setActive(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setActive(false); }}
      onDrop={(event) => { event.preventDefault(); setActive(false); onFiles(Array.from(event.dataTransfer.files)); }}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => { onFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }}
      />
      <div className="dropzone-icon"><UploadIcon size={26} /></div>
      <h3>{title}</h3>
      <p>{hint}</p>
      <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()}>
        <PlusIcon size={17} /> {buttonLabel}
      </button>
      <small className="dropzone-note"><ShieldIcon size={14} /> Files stay on your device · No account required</small>
    </div>
  );
}
