import { useState } from "react";
import { baseName, formatBytes, protectPdf, withExtension } from "@gattaimate/pdf-core";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBytes } from "../lib/browser";

export default function ProtectPage() {
  const [mode, setMode] = useState<"protect" | "unlock">("protect");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <SingleFileTool
      id="protect"
      accept="pdf"
      readPages={false}
      actionLabel={mode === "protect" ? "Protect & download" : "Unlock & download"}
      options={() => (
        <>
          <div className="segmented" role="radiogroup" aria-label="Mode">
            <label className={mode === "protect" ? "on" : ""}><input type="radio" checked={mode === "protect"} onChange={() => setMode("protect")} />Add password</label>
            <label className={mode === "unlock" ? "on" : ""}><input type="radio" checked={mode === "unlock"} onChange={() => setMode("unlock")} />Remove password</label>
          </div>
          <div className="field">
            <label htmlFor="pw">{mode === "protect" ? "New password" : "Current password"}</label>
            <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "protect" ? "new-password" : "current-password"} />
          </div>
          {mode === "protect" && (
            <div className="field">
              <label htmlFor="pw2">Repeat password</label>
              <input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              <small>Anyone opening the PDF will need this password. We can’t recover it — keep it safe. This uses standard RC4 128-bit PDF protection, which every reader supports but is a light deterrent, not strong encryption.</small>
            </div>
          )}
          {mode === "unlock" && <small className="hint">You must know the password — this removes it for your own files, it can’t guess or bypass one.</small>}
        </>
      )}
      run={async ({ file, bytes }) => {
        const data = await bytes();
        if (mode === "protect") {
          if (password !== confirm) throw new Error("The two passwords don't match.");
          const out = await protectPdf(data, password);
          const name = withExtension(`${baseName(file.name)}-protected`, ".pdf");
          const size = downloadBytes(out, name);
          return { message: `Saved ${name} (${formatBytes(size)}). It now asks for the password to open.`, name, size };
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
