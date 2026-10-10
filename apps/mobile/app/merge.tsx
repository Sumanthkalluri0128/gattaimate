import { useState } from "react";
import { View, Text } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  baseName, formatBytes, getPdfPageCount, isImageName, isPdfName, mergePdfBuffers, withExtension, type Rotation
} from "@gattaimate/pdf-core";
import { pickFiles, readBytes, saveAndShare, type Picked } from "../src/files";
import { useRecent } from "../src/recent";
import { colors } from "../src/theme";
import { Badge, Btn, Card, Field, Heading, IconBtn, Notice, Screen, s, type NoticeState } from "../src/ui";

type Item = Picked & { rotation: Rotation; pages?: number; problem?: string };

export default function MergeScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const imagesOnly = mode === "images";
  const title = imagesOnly ? "Images to PDF" : "Merge PDF";
  const recent = useRecent();

  const [items, setItems] = useState<Item[]>([]);
  const [outputName, setOutputName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const patch = (id: string, change: Partial<Item>) => setItems((cur) => cur.map((item) => (item.id === id ? { ...item, ...change } : item)));

  async function add() {
    try {
      const { files, rejected } = await pickFiles(imagesOnly ? "image" : "any", true);
      if (files.length === 0) {
        if (rejected) setNotice({ kind: "error", text: imagesOnly ? "Choose JPG, JPEG or PNG images." : "Choose PDF, JPG, JPEG or PNG files." });
        return;
      }
      setNotice(rejected ? { kind: "info", text: `Skipped ${rejected} unsupported file${rejected === 1 ? "" : "s"}.` } : null);
      if (items.length === 0 && !nameEdited) setOutputName(`${baseName(files[0].name) || "gattaimate"}-${imagesOnly ? "images" : "merged"}.pdf`);
      const added: Item[] = files.map((file) => ({ ...file, rotation: 0, pages: isImageName(file.name) ? 1 : undefined }));
      setItems((cur) => [...cur, ...added]);
      for (const item of added) {
        if (item.pages !== undefined) continue;
        try { patch(item.id, { pages: await getPdfPageCount(await readBytes(item.uri), item.name) }); }
        catch (error) { patch(item.id, { problem: error instanceof Error ? error.message : "This PDF could not be read." }); }
      }
    } catch {
      setNotice({ kind: "error", text: "Could not open the file picker. Please try again." });
    }
  }

  const move = (from: number, to: number) => setItems((cur) => {
    if (to < 0 || to >= cur.length) return cur;
    const next = [...cur];
    next.splice(to, 0, next.splice(from, 1)[0]);
    return next;
  });
  const clearAll = () => { setItems([]); setNotice(null); setNameEdited(false); setOutputName(""); };
  const remove = (id: string) => { if (items.length <= 1) clearAll(); else setItems((cur) => cur.filter((item) => item.id !== id)); };

  async function create() {
    if (busy || items.length === 0) return;
    setBusy(true);
    setNotice({ kind: "info", text: "Creating your PDF…" });
    try {
      const inputs = [];
      for (const item of items) inputs.push({ name: item.name, bytes: await readBytes(item.uri), rotation: item.rotation });
      const result = await mergePdfBuffers(inputs);
      const name = withExtension(outputName, ".pdf", imagesOnly ? "gattaimate-images" : "gattaimate-merged");
      const saved = await saveAndShare(result.bytes, name, "application/pdf");
      recent.add({ name, tool: imagesOnly ? "Images to PDF" : "Merge", pages: result.pageCount, size: saved.size });
      setNotice({ kind: "success", text: `Created ${name} with ${result.pageCount} page${result.pageCount === 1 ? "" : "s"} (${formatBytes(saved.size)}). ${saved.shared ? "Choose where to save or send it." : "Sharing isn't available, so it is stored in the app cache."}` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not create the PDF. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const total = items.reduce((sum, item) => sum + (item.size ?? 0), 0);
  const hasProblem = items.some((item) => item.problem);

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Heading title={title} color={imagesOnly ? "#279BFF" : "#FF477E"} blurb={imagesOnly ? "One image per A4 page, in the order shown." : "Combine PDFs and images. Use the arrows to set the order."} />
      <Btn variant="secondary" label={items.length ? "+ Add more files" : imagesOnly ? "Choose images" : "Choose PDFs & images"} onPress={() => void add()} disabled={busy} />

      {items.length > 0 && (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={s.h2}>Your files ({items.length})</Text>
            <Btn variant="ghost" small label="Clear all" onPress={clearAll} disabled={busy} />
          </View>
          {items.map((item, index) => (
            <View key={item.id} style={{ gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: item.problem ? "#FF7A8A66" : "#FFFFFF12", backgroundColor: "#12121E" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                <Badge label={isPdfName(item.name) ? "PDF" : "IMG"} tone={isPdfName(item.name) ? undefined : "image"} />
                <View style={{ flex: 1 }}>
                  <Text style={s.fileName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.meta}>{item.size ? formatBytes(item.size) : "—"} · {item.problem ? "" : item.pages === undefined ? "reading pages…" : `${item.pages} ${item.pages === 1 ? "page" : "pages"}`}{item.rotation ? ` · ↻ ${item.rotation}°` : ""}</Text>
                  {item.problem ? <Text style={{ color: colors.danger, fontSize: 11, marginTop: 3 }}>{item.problem}</Text> : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                <IconBtn label={`Rotate ${item.name} clockwise`} glyph="↻" onPress={() => patch(item.id, { rotation: ((item.rotation + 90) % 360) as Rotation })} />
                <IconBtn label="Move up" glyph="↑" disabled={index === 0} onPress={() => move(index, index - 1)} />
                <Text style={{ color: "#BCB4EC", minWidth: 16, textAlign: "center" }}>{index + 1}</Text>
                <IconBtn label="Move down" glyph="↓" disabled={index === items.length - 1} onPress={() => move(index, index + 1)} />
                <IconBtn label={`Remove ${item.name}`} glyph="×" onPress={() => remove(item.id)} />
              </View>
            </View>
          ))}
        </Card>
      )}

      <Card accent>
        <Field label="Output file name" value={outputName} onChangeText={(value) => { setOutputName(value); setNameEdited(true); }} placeholder={imagesOnly ? "gattaimate-images.pdf" : "gattaimate-merged.pdf"} maxLength={100} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={s.meta}>{items.length} {items.length === 1 ? "file" : "files"}</Text>
          <Text style={s.meta}>{formatBytes(total)}</Text>
        </View>
        <Btn label={items.length ? "Create PDF" : "Add files to begin"} onPress={() => void create()} busy={busy} disabled={items.length === 0 || hasProblem} />
        {hasProblem ? <Text style={{ color: colors.danger, fontSize: 11, textAlign: "center" }}>Remove the files marked with a problem, then try again.</Text> : null}
        <Text style={[s.meta, { textAlign: "center" }]}>✓ Processed on this device · No account needed</Text>
      </Card>
      <Notice notice={notice} />
    </Screen>
  );
}
