import { useState } from "react";
import { baseName, formatBytes, protectPdf, withExtension } from "@gattaimate/pdf-core";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBytes } from "../lib/browser";

export default function ProtectPage() {
  const [mode, setMode] = useState<"protect" | "change" | "unlock">("protect");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <SingleFileTool
      id="protect"
      accept="pdf"
      readPages={false}
      actionLabel={mode === "protect" ? "Protect & download" : mode === "change" ? "Change password & download" : "Unlock & download"}
      options={() => (
        <>
          <div className="segmented" role="radiogroup" aria-label="Mode">
            <label className={mode === "protect" ? "on" : ""}><input type="radio" checked={mode === "protect"} onChange={() => setMode("protect")} />Add password</label>
            <label className={mode === "change" ? "on" : ""}><input type="radio" checked={mode === "change"} onChange={() => setMode("change")} />Change password</label>
            <label className={mode === "unlock" ? "on" : ""}><input type="radio" checked={mode === "unlock"} onChange={() => setMode("unlock")} />Remove password</label>
          </div>
          {mode === "change" && (
            <div className="field"><label htmlFor="pw-current">Current password</label>
              <input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></div>
          )}
          <div className="field">
            <label htmlFor="pw">{mode === "unlock" ? "Current password" : "New password"}</label>
            <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "unlock" ? "current-password" : "new-password"} />
          </div>
          {mode !== "unlock" && (
            <div className="field">
              <label htmlFor="pw2">Repeat password</label>
              <input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              <small>Anyone opening the PDF will need this password. We can’t recover it — keep it safe. This uses standard RC4 128-bit PDF protection, which every reader supports but is a light deterrent, not strong encryption.</small>
            </div>
          )}
          {mode === "unlock" && <small className="hint">You must know the password — this removes it for your own files, it can’t guess or bypass one.</small>}
          <small className="hint">Tip: every other tool also opens locked PDFs — it asks for the password when you choose the file.</small>
        </>
      )}
      run={async ({ file, bytes }) => {
        const data = await bytes();
        if (mode === "protect" || mode === "change") {
          if (password !== confirm) throw new Error("The two passwords don't match.");
          let source = data;
          if (mode === "change") {
            if (!current) throw new Error("Enter the PDF's current password.");
            const { unlockPdf } = await import("../lib/qpdf");
            source = await unlockPdf(data, current);
          }
          const out = await protectPdf(source, password);
          const name = withExtension(`${baseName(file.name)}-protected`, ".pdf");
          const size = downloadBytes(out, name);
          return { message: `Saved ${name} (${formatBytes(size)}). ${mode === "change" ? "The old password no longer works." : "It now asks for the password to open."}`, name, size };
        }
        if (!password) throw new Error("Enter the PDF's current password.");
        const { unlockPdf } = await import("../lib/qpdf");
        const out = await unlockPdf(data, password);
        const name = withExtension(`${baseName(file.name)}-unlocked`, ".pdf");
        const size = downloadBytes(out, name);
        return { message: `Saved ${name} (${formatBytes(size)}). The password has been removed.`, name, size };
      }}
    />
  );
}
