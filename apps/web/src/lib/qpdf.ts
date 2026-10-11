import wasmUrl from "@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url";

type Qpdf = {
  FS: { writeFile(path: string, data: Uint8Array): void; readFile(path: string): Uint8Array };
  callMain(args: string[]): number;
};

/** Run qpdf once on a fresh WebAssembly instance (Emscripten programs can't be re-entered after exit). */
async function run(bytes: Uint8Array, args: string[], wantOutput: boolean): Promise<{ code: number; output: Uint8Array | null }> {
  const { default: createModule } = await import("@neslinesli93/qpdf-wasm");
  const create = createModule as unknown as (options: Record<string, unknown>) => Promise<Qpdf>;
  const qpdf = await create({ locateFile: () => wasmUrl, noInitialRun: true, print: () => undefined, printErr: () => undefined });
  qpdf.FS.writeFile("/in.pdf", bytes);
  let code = 0;
  try {
    code = qpdf.callMain(args);
  } catch (error) {
    // Emscripten throws an ExitStatus object for non-zero exits.
    code = typeof (error as { status?: number })?.status === "number" ? (error as { status: number }).status : 2;
  }
  let output: Uint8Array | null = null;
  if (wantOutput) { try { output = qpdf.FS.readFile("/out.pdf"); } catch { /* not produced */ } }
  return { code, output };
}

/**
 * Remove a PDF's password using qpdf (WebAssembly, loaded only when this tool is used).
 * Requires the correct password; it cannot guess or bypass one.
 */
export async function unlockPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  // qpdf --requires-password exits 3 when the supplied password is right. Any other result on an encrypted
  // file (qpdf reports both "wrong password" and "not encrypted" as 2) means the password is wrong.
  const encrypted = new TextDecoder("latin1").decode(bytes).includes("/Encrypt");
  const probe = await run(bytes, [`--password=${password}`, "--requires-password", "/in.pdf"], false);
  if (probe.code !== 3) {
    throw new Error(encrypted ? "That password is incorrect." : "This PDF isn't password-protected, so there is nothing to remove.");
  }

  const { code, output } = await run(bytes, [`--password=${password}`, "--decrypt", "/in.pdf", "/out.pdf"], true);
  if (!output || (code !== 0 && code !== 3)) throw new Error("Could not unlock this PDF. It may be damaged or use an unsupported protection.");
  return output;
}
