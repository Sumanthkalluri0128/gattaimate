import { useState } from "react";
import { errorMessage } from "../lib/browser";

type Props = {
  name: string;
  /** Should throw (with a readable message) when the password is wrong. */
  onUnlock: (password: string) => Promise<void>;
  compact?: boolean;
};

/** Ask for a PDF's password and unlock it for this session. The password is never stored. */
export default function UnlockPrompt({ name, onUnlock, compact }: Props) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy) return;
    if (!password) { setError("Enter the password."); return; }
    setBusy(true);
    setError("");
    try { await onUnlock(password); }
    catch (e) { setError(errorMessage(e, "Could not unlock this PDF.")); }
    finally { setBusy(false); }
  }

  return (
    <div className={`unlock${compact ? " compact" : ""}`}>
      {!compact && <p><b>🔒 This PDF is password-protected.</b> Enter its password to use it here. The password stays in this tab, and your original file is not changed.</p>}
      <div className="unlock-row">
        <input type="password" aria-label={`Password for ${name}`} placeholder="Password" value={password} autoComplete="off"
          onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submit()}>{busy ? <span className="spinner" /> : null}{busy ? "Unlocking…" : "Unlock"}</button>
      </div>
      {error && <small className="problem" role="alert">{error}</small>}
    </div>
  );
}
