import { useRef, useState } from "react";
import { Image, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  baseName, extractPdfPages, formatBytes, getPdfPageCount, optimizePdf, rotatePdfPages, splitPdfByRanges, splitPdfEvery,
  withExtension, zipFiles, type Rotation
} from "@gattaimate/pdf-core";
import { toolById, type ToolId } from "../../src/tools";
import { fileSize, pickFiles, readBytes, saveAndShare, shareUri, type PickKind, type Picked } from "../../src/files";
import { optimizeImage, rotateImage } from "../../src/images";
import { useRecent } from "../../src/recent";
import { Badge, Btn, Card, Field, Heading, Notice, Screen, Segmented, Stepper, s, type NoticeState } from "../../src/ui";

const KIND: Record<string, PickKind> = { split: "pdf", extract: "pdf", rotate: "pdf", "optimize-pdf": "pdf", "optimize-image": "image", preview: "any" };
const ACTION: Record<string, string> = { split: "Split & share ZIP", extract: "Extract & share", rotate: "Rotate & share", "optimize-pdf": "Optimize & share", "optimize-image": "Optimize & share", preview: "Open in PDF viewer" };
const SPLIT_HINT = "Each group becomes a PDF. Separate groups with ; and pages with commas — e.g. 1-2;3-5;6 or 1,3;2,4-5.";
const IMAGE_SIZES = [{ value: 0, label: "Original" }, { value: 2400, label: "2400" }, { value: 1600, label: "1600" }, { value: 1200, label: "1200" }];

export default function ToolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tool = toolById(id ?? "");
  const kind = KIND[id ?? ""];
  const recent = useRecent();
  const token = useRef(0);

  const [file, setFile] = useState<Picked | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  // option state (only the ones relevant to the current tool are shown)
  const [splitMode, setSplitMode] = useState<"groups" | "every">("groups");
  const [groups, setGroups] = useState("");
  const [every, setEvery] = useState(1);
  const [pages, setPages] = useState("");
  const [angle, setAngle] = useState<number>(90);
  const [scope, setScope] = useState<"all" | "range">("all");
  const [quality, setQuality] = useState(78);
  const [maxSide, setMaxSide] = useState(2400);
  const [previewRotation, setPreviewRotation] = useState<Rotation>(0);

  if (!tool || !kind) return <Screen><Heading title="Tool not found" /></Screen>;
  const isPdf = !!file && /\.pdf$/i.test(file.name);
  const toolId = tool.id as ToolId;

  async function choose() {
    try {
      const { files, rejected } = await pickFiles(kind, false);
      if (files.length === 0) {
        if (rejected) setNotice({ kind: "error", text: `That file isn't supported here. Choose ${kind === "pdf" ? "a PDF" : kind === "image" ? "a JPG, JPEG or PNG image" : "a PDF or image"}.` });
        return;
      }
      const chosen = files[0];
      const mine = ++token.current;
      setFile(chosen); setPageCount(null); setUnreadable(false); setNotice(null); setPreviewRotation(0);
      if (/\.pdf$/i.test(chosen.name)) {
        try {
          const count = await getPdfPageCount(await readBytes(chosen.uri), chosen.name);
          if (mine === token.current) setPageCount(count);
        } catch (error) {
          if (mine !== token.current) return;
          setUnreadable(true);
          setNotice({ kind: "error", text: error instanceof Error ? error.message : "This PDF could not be read." });
        }
      }
    } catch {
      setNotice({ kind: "error", text: "Could not open the file picker. Please try again." });
    }
  }

  async function finish(name: string, size: number, mime: string, bytes: Uint8Array | null, uri: string | null, pagesOut: number | undefined, message: string) {
    const saved = bytes ? await saveAndShare(bytes, name, mime) : { shared: (await shareUri(uri!, mime, name)).shared };
    recent.add({ name, tool: tool!.title, pages: pagesOut, size });
    setNotice({ kind: "success", text: `${message} ${saved.shared ? "Choose where to save or send it." : "Sharing isn't available, so it is stored in the app cache."}` });
  }

  async function run() {
    if (!file || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const base = baseName(file.name);
      if (toolId === "preview") {
        if (isPdf) { await shareUri(file.uri, "application/pdf", file.name); setNotice({ kind: "info", text: "Pick a PDF viewer app in the share sheet to read the document." }); }
        else {
          if (!previewRotation) { setNotice({ kind: "info", text: "Rotate the preview first, then save a copy." }); return; }
          const out = await rotateImage(file.uri, previewRotation, /\.png$/i.test(file.name));
          const png = /\.png$/i.test(file.name);
          await finish(withExtension(`${base}-rotated`, png ? ".png" : ".jpg"), await fileSize(out.uri), png ? "image/png" : "image/jpeg", null, out.uri, 1, "Saved a rotated copy.");
        }
      } else if (toolId === "optimize-image") {
        const out = await optimizeImage(file.uri, quality, maxSide);
        const size = await fileSize(out.uri);
        const delta = file.size ? Math.round((1 - size / file.size) * 100) : 0;
        await finish(withExtension(`${base}-optimized`, ".jpg"), size, "image/jpeg", null, out.uri, 1,
          `Saved ${out.width}×${out.height} JPG: ${formatBytes(file.size ?? 0)} → ${formatBytes(size)} (${delta > 0 ? `${delta}% smaller` : "not smaller — try a lower quality or size"}).`);
      } else {
        const bytes = await readBytes(file.uri);
        if (toolId === "split") {
          const parts = splitMode === "groups" ? await splitPdfByRanges(bytes, groups) : await splitPdfEvery(bytes, every);
          const pad = String(parts.length).length;
          const zip = zipFiles(parts.map((part, i) => ({ name: withExtension(`${base}-part-${String(i + 1).padStart(pad, "0")}`, ".pdf"), bytes: part.bytes })));
          await finish(withExtension(`${base}-split`, ".zip"), zip.byteLength, "application/zip", zip, null, parts.reduce((n, p) => n + p.pageCount, 0), `Created ${parts.length} PDFs in one ZIP.`);
        } else if (toolId === "extract") {
          const out = await extractPdfPages(bytes, pages);
          await finish(withExtension(`${base}-pages`, ".pdf"), out.bytes.byteLength, "application/pdf", out.bytes, null, out.pageCount, `Extracted ${out.pageCount} page${out.pageCount === 1 ? "" : "s"}.`);
        } else if (toolId === "rotate") {
          const out = await rotatePdfPages(bytes, angle, scope === "all" ? "all" : pages);
          await finish(withExtension(`${base}-rotated`, ".pdf"), out.bytes.byteLength, "application/pdf", out.bytes, null, out.pageCount, `Rotated ${scope === "all" ? "all pages" : "the selected pages"}.`);
        } else if (toolId === "optimize-pdf") {
          const out = await optimizePdf(bytes);
          const delta = Math.round((1 - out.bytes.byteLength / bytes.byteLength) * 100);
          await finish(withExtension(`${base}-optimized`, ".pdf"), out.bytes.byteLength, "application/pdf", out.bytes, null, out.pageCount,
            `${formatBytes(bytes.byteLength)} → ${formatBytes(out.bytes.byteLength)} (${delta > 0 ? `${delta}% smaller` : "about the same size"}). Text and links are kept; this only rewrites the file more efficiently.`);
        }
      }
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const rangeHint = pageCount ? `This PDF has ${pageCount} pages.` : "";

  return (
    <Screen>
      <Stack.Screen options={{ title: tool.title }} />
      <Heading title={tool.title} blurb={tool.blurb} color={tool.color} />

      {!file ? (
        <Btn variant="secondary" label={kind === "image" ? "Choose an image" : kind === "pdf" ? "Choose a PDF" : "Choose a PDF or image"} onPress={() => void choose()} />
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Badge label={isPdf ? "PDF" : "IMG"} tone={isPdf ? undefined : "image"} />
              <View style={{ flex: 1 }}>
                <Text style={s.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={s.meta}>{file.size ? formatBytes(file.size) : "—"}{isPdf && !unreadable ? ` · ${pageCount === null ? "reading pages…" : `${pageCount} ${pageCount === 1 ? "page" : "pages"}`}` : ""}</Text>
              </View>
              <Btn variant="ghost" small label="Change" onPress={() => void choose()} disabled={busy} />
            </View>
          </Card>

          {!unreadable && (
            <Card accent>
              {toolId === "split" && (<>
                <Segmented value={splitMode} onChange={setSplitMode} options={[{ value: "groups", label: "Page groups" }, { value: "every", label: "Every N pages" }]} />
                {splitMode === "groups"
                  ? <Field label="Page groups" value={groups} onChangeText={setGroups} placeholder={pageCount && pageCount > 2 ? `1-2;3-${pageCount}` : "1-2;3-5;6"} hint={SPLIT_HINT} />
                  : <Stepper label="Pages per file" value={every} min={1} max={Math.max(1, (pageCount ?? 2) - 1)} step={1} onChange={setEvery} />}
              </>)}
              {toolId === "extract" && <Field label="Pages to keep" value={pages} onChangeText={setPages} placeholder="1-3,5" hint={`Example: 1-3,5,8-9. ${rangeHint}`} />}
              {toolId === "rotate" && (<>
                <Segmented label="Rotate" value={angle} onChange={setAngle} options={[{ value: 90, label: "90° right" }, { value: 180, label: "180°" }, { value: 270, label: "90° left" }]} />
                <Segmented label="Pages" value={scope} onChange={setScope} options={[{ value: "all", label: "All pages" }, { value: "range", label: "Selected" }]} />
                {scope === "range" && <Field label="Pages to rotate" value={pages} onChangeText={setPages} placeholder="1-3,5" hint={rangeHint} />}
              </>)}
              {toolId === "optimize-pdf" && <Text style={s.muted}>Rewrites the PDF more efficiently and clears title/author metadata. Text, links and forms are kept, so savings are often small. For big savings on scans, use the web app’s “Smaller file” mode.</Text>}
              {toolId === "optimize-image" && (<>
                <Stepper label="JPEG quality" value={quality} min={35} max={95} step={5} onChange={setQuality} format={(v) => `${v}%`} />
                <Segmented label="Longest side (px)" value={maxSide} onChange={setMaxSide} options={IMAGE_SIZES} />
                <Text style={s.hint}>Saved as JPG. PNG transparency becomes white. Smaller images are never enlarged.</Text>
              </>)}
              {toolId === "preview" && (isPdf
                ? <Text style={s.muted}>PDFs open in your phone’s PDF viewer through the share sheet. Nothing is uploaded.</Text>
                : (<>
                    <View style={{ aspectRatio: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B0C16", borderRadius: 12, overflow: "hidden" }}>
                      <Image source={{ uri: file.uri }} resizeMode="contain" style={{ width: "100%", height: "100%", transform: [{ rotate: `${previewRotation}deg` }] }} accessibilityLabel={file.name} />
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}><Btn variant="secondary" small label="↶ Left" onPress={() => setPreviewRotation((r) => ((r + 270) % 360) as Rotation)} /></View>
                      <View style={{ flex: 1 }}><Btn variant="secondary" small label="↻ Right" onPress={() => setPreviewRotation((r) => ((r + 90) % 360) as Rotation)} /></View>
                    </View>
                  </>))}
              <Btn label={toolId === "preview" && !isPdf ? "Save rotated copy" : ACTION[toolId]} onPress={() => void run()} busy={busy} disabled={(isPdf && pageCount === null) || (toolId === "preview" && !isPdf && previewRotation === 0)} />
              <Text style={[s.meta, { textAlign: "center" }]}>Your original file is never changed.</Text>
            </Card>
          )}
        </>
      )}
      <Notice notice={notice} />
    </Screen>
  );
}
