import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { fromByteArray, toByteArray } from "base64-js";
import { mergePdfBuffers, splitPdfByRanges, rotatePdfPages, extractPdfPages, optimizePdf } from "@gattaimate/pdf-core";

type ToolMode = "split" | "rotate" | "extract" | "compress" | "preview" | null;
type PickedFile = { id: string; name: string; uri: string; size?: number; mimeType?: string | null };

const formatBytes = (bytes?: number) => {
  if (!bytes) return "PDF document";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function HomeScreen() {
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [outputName, setOutputName] = useState("gattaimate-merged.pdf");
  const [outputNameEdited, setOutputNameEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Your documents stay on this device.");
  const [recentFiles, setRecentFiles] = useState<{ name: string; pages: number; size: number; time: string }[]>([]);
  const [activeTool, setActiveTool] = useState<ToolMode>(null);
  const [pageRange, setPageRange] = useState("1-2,3-4");
  const [rotation, setRotation] = useState<90 | 180 | 270>(90);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + (file.size ?? 0), 0), [files]);

  async function pickFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        multiple: true,
        copyToCacheDirectory: true
      });
      if (result.canceled) return;

      const newFiles: PickedFile[] = result.assets
        .filter((asset) => {
          const name = asset.name.toLowerCase();
          return /\.(pdf|jpe?g|png)$/.test(name) || ["application/pdf", "image/jpeg", "image/png"].includes(asset.mimeType ?? "");
        })
        .map((asset) => ({
          id: `${asset.uri}-${asset.name}`,
          name: asset.name,
          uri: asset.uri,
          size: asset.size,
          mimeType: asset.mimeType
        }));

      if (newFiles.length === 0) {
        setStatus("No supported files selected. Choose PDF, JPG, JPEG, or PNG files.");
        return;
      }

      if (newFiles.length > 0 && files.length === 0 && !outputNameEdited) {
        const firstBaseName = newFiles[0].name.replace(/\.(pdf|jpe?g|png)$/i, "").trim();
        setOutputName(`${firstBaseName || "gattaimate"}-merged.pdf`);
      }
      setFiles((current) => {
        const seen = new Set(current.map((file) => file.uri));
        return [...current, ...newFiles.filter((file) => !seen.has(file.uri))];
      });
      setStatus(`${newFiles.length} PDF/image file(s) added.`);
    } catch {
      setStatus("Could not open the document picker. Please try again.");
    }
  }

  function move(index: number, delta: number) {
    setFiles((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function sharePdf(bytes: Uint8Array, name: string) {
    const safeName = name.replace(/[\\/:*?"<>|]/g, "_").replace(/\.pdf$/i, "") + ".pdf";
    const uri = `${FileSystem.cacheDirectory}${safeName}`;
    await FileSystem.writeAsStringAsync(uri, fromByteArray(bytes), { encoding: FileSystem.EncodingType.Base64 });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: safeName, UTI: "com.adobe.pdf" });
    else Alert.alert("PDF created", `Saved temporarily at ${uri}`);
  }

  async function runSelectedTool() {
    if (!activeTool) return;
    const file = files.find((item) => item.name.toLowerCase().endsWith(".pdf"));
    if (!file) { setStatus("Choose a PDF first. This tool does not process image-only selections."); return; }
    setBusy(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const bytes = toByteArray(base64);
      const base = file.name.replace(/\.pdf$/i, "");
      if (activeTool === "split") {
        const results = await splitPdfByRanges(bytes, pageRange);
        for (let i = 0; i < results.length; i++) await sharePdf(results[i].bytes, `${base}-part-${i + 1}.pdf`);
        setStatus(`Created ${results.length} PDF parts. Use the share sheet to save or send each part.`);
      } else if (activeTool === "extract") {
        const result = await extractPdfPages(bytes, pageRange);
        await sharePdf(result.bytes, `${base}-pages.pdf`);
        setStatus(`Extracted ${result.pageCount} page(s).`);
      } else if (activeTool === "rotate") {
        const result = await rotatePdfPages(bytes, rotation, pageRange.trim() || "all");
        await sharePdf(result.bytes, `${base}-rotated.pdf`);
        setStatus("Rotated PDF is ready to save or share.");
      } else if (activeTool === "compress") {
        const result = await optimizePdf(bytes);
        await sharePdf(result.bytes, `${base}-optimized.pdf`);
        setStatus("Structural optimization complete. This does not use lossy image compression, so some files may not shrink.");
      } else if (activeTool === "preview") {
        await sharePdf(bytes, `${base}-preview.pdf`);
        setStatus("Choose a PDF viewer in the share sheet to preview this document.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not process this PDF. It may be damaged or password-protected.");
    } finally { setBusy(false); }
  }

  async function merge() {
    if (files.length < 2) {
      setStatus("Please select at least one PDF or image file.");
      return;
    }

    setBusy(true);
    setStatus("Converting images and creating your PDF…");
    try {
      const inputs = await Promise.all(files.map(async (file) => {
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64
        });
        return { name: file.name, bytes: toByteArray(base64) };
      }));

      const result = await mergePdfBuffers(inputs);
      const safeName = (outputName.trim() || "gattaimate-merged").replace(/[\\/:*?"<>|]/g, "_");
      const finalName = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
      const outputUri = `${FileSystem.cacheDirectory}${finalName}`;
      await FileSystem.writeAsStringAsync(outputUri, fromByteArray(result.bytes), {
        encoding: FileSystem.EncodingType.Base64
      });

      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(outputUri, {
          mimeType: "application/pdf",
          dialogTitle: "Share your merged PDF",
          UTI: "com.adobe.pdf"
        });
        setRecentFiles((current) => [{ name: finalName, pages: result.pageCount, size: result.bytes.byteLength, time: "Just now" }, ...current].slice(0, 4));
        setStatus(`Merged ${files.length} files into ${result.pageCount} pages. Choose an app or destination in the share sheet.`);
      } else {
        setStatus(`Merged PDF saved temporarily at ${outputUri}. Sharing is not available on this device.`);
        Alert.alert("PDF merged", `The merged file was created in the app cache:\n${outputUri}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not merge these PDFs. Please try different files.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.topbar}>
        <Image source={require("../assets/icon.png")} style={styles.brandImage} />
        <View style={styles.brandBlock}><Text style={styles.brand}>Gattai<Text style={styles.brandLight}>Mate</Text></Text><Text style={styles.brandTagline}>All your documents. One powerful app.</Text></View>
        <View style={styles.privacyPill}><View style={styles.greenDot} /><Text style={styles.privacyText}>Private</Text></View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>FAST · PRIVATE · OFFLINE</Text>
        <Text style={styles.title}>Complete{`\n`}<Text style={styles.titleAccent}>PDF Toolkit</Text></Text>
        <Text style={styles.subtitle}>Merge, convert and organize documents. Your files stay on your device.</Text>
      </View>

      <View style={styles.toolSection}>
        <Text style={styles.sectionTitle}>Your document toolkit</Text>
        <Text style={styles.muted}>Fast · Private · All in one place</Text>
        <View style={styles.toolGrid}>
          {[
            { title: "Merge PDF", glyph: "▤", color: "#FF477E", active: true },
            { title: "Images to PDF", glyph: "▧", color: "#279BFF", active: true },
            { title: "Split PDF", glyph: "✂", color: "#A75BFF", active: true, mode: "split" as const },
            { title: "Rotate PDF", glyph: "⟳", color: "#18C995", active: true, mode: "rotate" as const },
            { title: "Extract Pages", glyph: "▤", color: "#FF9B43", active: true, mode: "extract" as const },
            { title: "Optimize PDF", glyph: "⤢", color: "#A75BFF", active: true, mode: "compress" as const },
            { title: "Organize Pages", glyph: "▦", color: "#ED49C4", active: true, mode: "organize" as const },
            { title: "Preview PDF", glyph: "◉", color: "#6084FF", active: true, mode: "preview" as const }
          ].map((tool) => (
            <Pressable key={tool.title} style={[styles.toolCard, { borderColor: `${tool.color}55` }]} onPress={() => {
              if (tool.mode === "organize") { void pickFiles(); setStatus("Use the up/down controls in the selected file list to organize files before merging."); }
              else { setActiveTool(tool.mode); setPageRange(tool.mode === "split" ? "1-2,3-4" : tool.mode === "extract" ? "1-3" : "all"); setStatus(tool.mode === "preview" ? "Choose a PDF, then tap Open / Share PDF to preview it." : "Choose a PDF, configure the options below, then run the tool."); }
            }}>
              <View style={[styles.toolGlyphBox, { backgroundColor: `${tool.color}25` }]}><Text style={[styles.toolGlyph, { color: tool.color }]}>{tool.glyph}</Text></View>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolHint}>Open tool</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.privacyBanner}><Text style={styles.privacyShield}>◆</Text><View style={{ flex: 1 }}><Text style={styles.privacyBannerTitle}>100% private by design</Text><Text style={styles.privacyBannerText}>Processing happens on your device. No files are uploaded.</Text></View></View>
      </View>

      {activeTool && (
        <View style={styles.mergePanel}>
          <View style={styles.sectionHeader}><Text style={styles.panelTitle}>{({ split: "Split PDF", rotate: "Rotate PDF", extract: "Extract Pages", compress: "Optimize PDF", preview: "Preview PDF" } as const)[activeTool]}</Text><Pressable onPress={() => setActiveTool(null)}><Text style={styles.clearText}>Close</Text></Pressable></View>
          <Text style={styles.muted}>Uses the first selected PDF. Select a PDF below if you have not already.</Text>
          {(activeTool === "split" || activeTool === "extract" || activeTool === "rotate") && <><Text style={styles.inputLabel}>{activeTool === "split" ? "PAGE GROUPS (example: 1-2,3-5)" : activeTool === "extract" ? "PAGES TO KEEP (example: 1-3,5)" : "PAGES TO ROTATE (all or 1-3)"}</Text><TextInput value={pageRange} onChangeText={setPageRange} style={styles.input} autoCapitalize="none" /></>}
          {activeTool === "rotate" && <><Text style={styles.inputLabel}>ROTATION</Text><View style={styles.controls}>{([90, 180, 270] as const).map((deg) => <Pressable key={deg} onPress={() => setRotation(deg)} style={[styles.controlButton, rotation === deg && styles.selectedControl]}><Text style={styles.controlText}>{deg}°</Text></Pressable>)}</View></>}
          {activeTool === "compress" && <Text style={styles.muted}>Structural optimization only; no lossy image compression. The output may not always be smaller.</Text>}
          <Pressable disabled={busy} style={[styles.mergeButton, busy && styles.disabled]} onPress={() => void runSelectedTool()}>{busy ? <ActivityIndicator color="#171326" /> : <Text style={styles.mergeButtonText}>{activeTool === "preview" ? "Open / Share PDF" : "Process PDF"}</Text>}</Pressable>
        </View>
      )}

      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Recent files</Text><Text style={styles.muted}>History stays on this device</Text></View>
          <Text style={styles.count}>{recentFiles.length} recent</Text>
        </View>
        {recentFiles.length === 0 ? (
          <View style={styles.recentEmpty}><Text style={styles.recentClock}>◷</Text><View style={{ flex: 1 }}><Text style={styles.recentTitle}>Your PDFs will appear here</Text><Text style={styles.muted}>Create a PDF to start your local history.</Text></View></View>
        ) : recentFiles.map((recent, index) => (
          <View style={styles.recentRow} key={`${recent.name}-${index}`}><View style={styles.recentPdf}><Text style={styles.pdfBadgeText}>PDF</Text></View><View style={{ flex: 1 }}><Text style={styles.recentTitle} numberOfLines={1}>{recent.name}</Text><Text style={styles.muted}>{recent.pages} pages · {formatBytes(recent.size)} · {recent.time}</Text></View></View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <View><Text style={styles.sectionTitle}>Your workspace</Text><Text style={styles.muted}>Arrange files in the order you need.</Text></View>
        <Text style={styles.count}>{files.length} files</Text>
      </View>

      <Pressable style={styles.pickCard} onPress={() => void pickFiles()}>
        <View style={styles.uploadBadge}><Text style={styles.uploadGlyph}>↑</Text></View>
        <Text style={styles.pickTitle}>Choose PDFs & images</Text>
        <Text style={styles.muted}>PDF, JPG, JPEG, or PNG · Images become PDF pages</Text>
        <View style={styles.pickButton}><Text style={styles.pickButtonText}>Browse documents  +</Text></View>
      </Pressable>

      {files.length > 0 && (
        <View style={styles.filePanel}>
          <View style={styles.filePanelHeader}>
            <Text style={styles.panelTitle}>Selected documents</Text>
            <Pressable onPress={() => { setFiles([]); setStatus("Selection cleared."); if (!outputNameEdited) setOutputName("gattaimate-merged.pdf"); }}><Text style={styles.clearText}>Clear all</Text></Pressable>
          </View>
          {files.map((file, index) => (
            <View style={styles.fileRow} key={file.id}>
              <View style={[styles.pdfBadge, /\.(jpe?g|png)$/i.test(file.name) && styles.imageBadge]}><Text style={styles.pdfBadgeText}>{/\.(jpe?g|png)$/i.test(file.name) ? "IMG" : "PDF"}</Text></View>
              <View style={styles.fileDetails}>
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.fileMeta}>{formatBytes(file.size)}</Text>
              </View>
              <View style={styles.controls}>
                <Pressable accessibilityLabel="Move up" disabled={index === 0} style={[styles.controlButton, index === 0 && styles.disabled]} onPress={() => move(index, -1)}><Text style={styles.controlText}>↑</Text></Pressable>
                <Text style={styles.orderNumber}>{index + 1}</Text>
                <Pressable accessibilityLabel="Move down" disabled={index === files.length - 1} style={[styles.controlButton, index === files.length - 1 && styles.disabled]} onPress={() => move(index, 1)}><Text style={styles.controlText}>↓</Text></Pressable>
                <Pressable accessibilityLabel={`Remove ${file.name}`} onPress={() => setFiles((current) => current.filter((item) => item.id !== file.id))}><Text style={styles.remove}>×</Text></Pressable>
              </View>
            </View>
          ))}
          <Pressable style={styles.addMore} onPress={() => void pickFiles()}><Text style={styles.addMoreText}>+ Add more PDFs or images</Text></Pressable>
        </View>
      )}

      <View style={styles.mergePanel}>
        <Text style={styles.panelTitle}>Create your merged PDF</Text>
        <Text style={styles.muted}>Original documents will not be changed.</Text>
        <Text style={styles.inputLabel}>OUTPUT FILE NAME</Text>
        <TextInput value={outputName} onChangeText={(value) => { setOutputName(value); setOutputNameEdited(true); }} style={styles.input} autoCapitalize="none" maxLength={100} />
        <View style={styles.summary}><Text style={styles.summaryText}>{files.length} files</Text><Text style={styles.summaryText}>{formatBytes(totalSize)}</Text></View>
        <Pressable disabled={busy || files.length < 1} style={[styles.mergeButton, (busy || files.length < 1) && styles.disabled]} onPress={() => void merge()}>
          {busy ? <ActivityIndicator color="#171326" /> : <Text style={styles.mergeButtonText}>Create PDF  ↗</Text>}
        </Pressable>
        <Text style={styles.privacyNote}>✓  Processed locally · No account needed</Text>
      </View>

      <View style={styles.statusBox}><Text style={styles.statusText}>{status}</Text></View>
      <Text style={styles.footer}>GattaiMate · Made for documents that belong together.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 24, paddingBottom: 40, backgroundColor: "#10111D", flexGrow: 1 },
  topbar: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: "#FFFFFF12" },
  brandMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#A998FF", alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#171326", fontWeight: "900", fontSize: 18 },
  brand: { color: "#F8F6FF", fontSize: 19, fontWeight: "800", letterSpacing: -0.7, flex: 1 },
  brandLight: { color: "#AAA0E6", fontWeight: "500" },
  privacyPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#FFFFFF1A", borderRadius: 30, paddingVertical: 7, paddingHorizontal: 10 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#73D8B2" },
  privacyText: { color: "#D0CFE0", fontSize: 11 },
  hero: { paddingTop: 35, paddingBottom: 30 },
  eyebrow: { color: "#B7AAFF", fontSize: 10, letterSpacing: 1.8, fontWeight: "700" },
  title: { color: "#F7F5FF", fontSize: 43, lineHeight: 47, fontWeight: "900", letterSpacing: -2, marginTop: 15 },
  titleAccent: { color: "#A99AFF" },
  subtitle: { color: "#A7A7BC", fontSize: 13, lineHeight: 20, marginTop: 13, maxWidth: 310 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  sectionTitle: { color: "#F4F3FB", fontSize: 17, fontWeight: "700", marginBottom: 5 },
  muted: { color: "#A5A6BA", fontSize: 11, lineHeight: 16 },
  count: { color: "#D4CDFB", backgroundColor: "#A998FF18", borderColor: "#A998FF38", borderWidth: 1, overflow: "hidden", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, fontSize: 11 },
  pickCard: { borderWidth: 1, borderStyle: "dashed", borderColor: "#625B85", borderRadius: 17, minHeight: 195, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "#A998FF08" },
  uploadBadge: { width: 45, height: 45, borderRadius: 14, backgroundColor: "#A998FF1B", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  uploadGlyph: { color: "#C0B4FF", fontSize: 27, fontWeight: "400" },
  pickTitle: { color: "#F7F5FF", fontWeight: "700", fontSize: 15, marginBottom: 6 },
  pickButton: { marginTop: 15, backgroundColor: "#29263C", borderColor: "#4D4768", borderWidth: 1, borderRadius: 9, paddingHorizontal: 15, paddingVertical: 11 },
  pickButtonText: { color: "#EEE AFF".replace(" ", ""), fontSize: 12, fontWeight: "700" },
  filePanel: { borderWidth: 1, borderColor: "#FFFFFF12", borderRadius: 15, padding: 12, marginTop: 18, backgroundColor: "#FFFFFF04" },
  filePanelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  panelTitle: { color: "#F6F4FF", fontSize: 14, fontWeight: "700" },
  clearText: { color: "#B8AAFF", fontSize: 11, padding: 5 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#151522", borderWidth: 1, borderColor: "#FFFFFF0D", borderRadius: 10, padding: 9, marginBottom: 7 },
  pdfBadge: { width: 35, height: 39, backgroundColor: "#ED7E8B14", borderRadius: 7, alignItems: "center", justifyContent: "center" },
  pdfBadgeText: { color: "#F49CA6", fontSize: 9, fontWeight: "800" },
  imageBadge: { backgroundColor: "#73D8B214" },
  fileDetails: { flex: 1, minWidth: 0 },
  fileName: { color: "#F0EFF9", fontSize: 11, fontWeight: "600" },
  fileMeta: { color: "#8E8EA5", fontSize: 10, marginTop: 5 },
  controls: { flexDirection: "row", alignItems: "center", gap: 4 },
  selectedControl: { backgroundColor: "#A998FF55", borderColor: "#A998FF" },
  controlButton: { width: 23, height: 25, borderRadius: 6, borderWidth: 1, borderColor: "#39364F", backgroundColor: "#211F31", alignItems: "center", justifyContent: "center" },
  controlText: { color: "#E0DCF8", fontSize: 12 },
  orderNumber: { color: "#BCB4EC", fontSize: 10, minWidth: 12, textAlign: "center" },
  remove: { color: "#A5A3B8", fontSize: 21, marginLeft: 2, paddingHorizontal: 2 },
  disabled: { opacity: 0.35 },
  addMore: { paddingVertical: 9 },
  addMoreText: { color: "#B9ACFF", fontSize: 11, fontWeight: "700" },
  mergePanel: { borderWidth: 1, borderColor: "#8172BD45", borderRadius: 15, padding: 16, marginTop: 18, backgroundColor: "#242039" },
  inputLabel: { color: "#9291A9", fontSize: 9, letterSpacing: 1.3, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  input: { color: "#F5F3FF", backgroundColor: "#141421", borderWidth: 1, borderColor: "#444057", borderRadius: 9, padding: 12, fontSize: 12 },
  summary: { flexDirection: "row", justifyContent: "space-between", marginTop: 13, marginBottom: 15 },
  summaryText: { color: "#9D9CB3", fontSize: 10 },
  mergeButton: { backgroundColor: "#A998FF", borderRadius: 10, alignItems: "center", justifyContent: "center", minHeight: 48 },
  mergeButtonText: { color: "#171326", fontWeight: "800", fontSize: 13 },
  privacyNote: { textAlign: "center", color: "#8F8DA6", fontSize: 10, marginTop: 13 },
  statusBox: { borderWidth: 1, borderColor: "#FFFFFF12", borderRadius: 10, padding: 12, marginTop: 13, backgroundColor: "#FFFFFF05" },
  statusText: { color: "#C7C4D9", fontSize: 11, lineHeight: 16 },
  footer: { color: "#77778D", fontSize: 10, textAlign: "center", marginTop: 28 },
  toolSection: { marginBottom: 22, marginTop: 4 },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 13 },
  toolCard: { width: "48%", flexGrow: 1, minHeight: 112, borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: "#151629", overflow: "hidden" },
  toolGlyphBox: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  toolGlyph: { fontSize: 23, fontWeight: "800" },
  toolTitle: { color: "#F5F3FF", fontSize: 12, fontWeight: "800" },
  toolHint: { color: "#9291AE", fontSize: 10, marginTop: 5 },
  privacyBanner: { flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 13, borderWidth: 1, borderColor: "#36D6B344", backgroundColor: "#12302E88", padding: 13, marginTop: 13 },
  privacyShield: { color: "#51E0B4", fontSize: 22 },
  privacyBannerTitle: { color: "#DDFBF1", fontSize: 12, fontWeight: "800", marginBottom: 4 },
  privacyBannerText: { color: "#A3C8C0", fontSize: 10, lineHeight: 15 },
  brandImage: { width: 38, height: 38, borderRadius: 11 },
  brandBlock: { flex: 1, minWidth: 0 },
  brandTagline: { color: "#9B9CB8", fontSize: 9, marginTop: 2 },
  recentSection: { marginTop: 2, marginBottom: 22 },
  recentEmpty: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: "#A998FF25", backgroundColor: "#111629" },
  recentClock: { color: "#B69CFF", fontSize: 25 },
  recentTitle: { color: "#F5F3FF", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: "#FFFFFF10", backgroundColor: "#111629", marginBottom: 7 },
  recentPdf: { width: 34, height: 39, borderRadius: 8, backgroundColor: "#FF477E20", alignItems: "center", justifyContent: "center" }
});
