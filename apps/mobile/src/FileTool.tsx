import { useEffect, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Stack } from "expo-router";
import { formatBytes, getPdfPageCount, isPdfName } from "@gattaimate/pdf-core";
import { openInViewer, pickFiles, readBytes, saveAndShare, shareUri, type Picked } from "./files";
import ImagePreview from "./ImagePreview";
import { takeIncoming } from "./incoming";
import { useRecent } from "./recent";
import { toolById, type ToolId } from "./tools";
import { Badge, Btn, Card, Heading, Notice, Screen, SizeBars, s, type NoticeState } from "./ui";

export type ToolContext = { file: Picked; pageCount: number | null; bytes: () => Promise<Uint8Array> };
/** Exactly one of `bytes` (in-memory result) or `uri` (a file already on disk) should be set. */
export type ToolResult = { name: string; mime: string; message: string; bytes?: Uint8Array; uri?: string; size?: number; pages?: number; before?: number };

type Props = {
  id: ToolId;
  kind: "pdf" | "image";
  /** false for tools that must accept password-protected PDFs. */
  readPages?: boolean;
  actionLabel: string;
  options?: (info: { file: Picked; pageCount: number | null }) => ReactNode;
  run: (context: ToolContext) => Promise<ToolResult>;
};

/** One file in → options → one action → share sheet. Shared by every single-file tool. */
export default function FileTool({ id, kind, readPages = true, actionLabel, options, run }: Props) {
  const tool = toolById(id)!;
  const recent = useRecent();
  const token = useRef(0);
  const needsPages = kind === "pdf" && readPages;

  const [file, setFile] = useState<Picked | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [compare, setCompare] = useState<{ before: number; after: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  async function adopt(chosen: Picked) {
    const mine = ++token.current;
    setFile(chosen); setPageCount(null); setUnreadable(false); setNotice(null); setCompare(null);
    if (needsPages) {
      try {
        const count = await getPdfPageCount(await readBytes(chosen.uri), chosen.name);
        if (mine === token.current) setPageCount(count);
      } catch (error) {
        if (mine !== token.current) return;
        setUnreadable(true);
        setNotice({ kind: "error", text: error instanceof Error ? error.message : "This PDF could not be read." });
      }
    }
  }

  async function choose() {
    try {
      const { files, rejected } = await pickFiles(kind, false);
      if (files.length === 0) {
        if (rejected) setNotice({ kind: "error", text: `That file isn't supported here. Choose ${kind === "pdf" ? "a PDF" : "a JPG, JPEG or PNG image"}.` });
        return;
      }
      await adopt(files[0]);
    } catch {
      setNotice({ kind: "error", text: "Could not open the file picker. Please try again." });
    }
  }

  // A file shared from another app ("Share → GattaiMate") is claimed on arrival.
  useEffect(() => { const [first] = takeIncoming(kind); if (first) void adopt(first); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!file || busy) return;
    setBusy(true); setNotice(null); setCompare(null);
    try {
      const result = await run({ file, pageCount, bytes: () => readBytes(file.uri) });
      let size = result.size ?? 0;
      let shared: boolean;
      if (result.bytes) { const saved = await saveAndShare(result.bytes, result.name, result.mime); size = saved.size; shared = saved.shared; }
      else shared = (await shareUri(result.uri!, result.mime, result.name)).shared;
      recent.add({ name: result.name, tool: tool.title, pages: result.pages, size });
      setNotice({ kind: "success", text: `${result.message} ${shared ? "Choose where to save or send it." : "Sharing isn't available, so it is stored in the app cache."}` });
      if (result.before) setCompare({ before: result.before, after: size });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const isPdf = !!file && isPdfName(file.name);
  return (
    <Screen>
      <Stack.Screen options={{ title: tool.title }} />
      <Heading title={tool.title} blurb={tool.blurb} color={tool.color} />
      {!file ? (
        <Btn variant="secondary" label={kind === "image" ? "Choose an image" : "Choose a PDF"} onPress={() => void choose()} />
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Badge label={isPdf ? "PDF" : "IMG"} tone={isPdf ? undefined : "image"} />
              <View style={{ flex: 1 }}>
                <Text style={s.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={s.meta}>{file.size ? formatBytes(file.size) : "—"}{needsPages && !unreadable ? ` · ${pageCount === null ? "reading pages…" : `${pageCount} ${pageCount === 1 ? "page" : "pages"}`}` : ""}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Btn variant="secondary" small label="Preview" disabled={busy || unreadable} onPress={() => { if (isPdf) void openInViewer(file.uri, file.name); else setPreviewing(true); }} /></View>
              <View style={{ flex: 1 }}><Btn variant="ghost" small label="Change file" disabled={busy} onPress={() => void choose()} /></View>
            </View>
          </Card>
          {!unreadable && (
            <Card accent>
              {options?.({ file, pageCount })}
              <Btn label={actionLabel} onPress={() => void submit()} busy={busy} disabled={needsPages && pageCount === null} />
              <Text style={[s.meta, { textAlign: "center" }]}>Your original file is never changed.</Text>
            </Card>
          )}
        </>
      )}
      <Notice notice={notice} />
      {compare && <SizeBars before={compare.before} after={compare.after} />}
      {previewing && file && <ImagePreview file={file} onClose={() => setPreviewing(false)} />}
    </Screen>
  );
}
