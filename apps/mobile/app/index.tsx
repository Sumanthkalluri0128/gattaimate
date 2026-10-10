import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { mergePdfBuffers } from "@gattaimate/pdf-core";

type PickedPdf = { id: string; name: string; uri: string; size?: number };

const formatBytes = (bytes?: number) => {
  if (!bytes) return "PDF document";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function HomeScreen() {
  const [files, setFiles] = useState<PickedPdf[]>([]);
  const [outputName, setOutputName] = useState("gattaimate-merged.pdf");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Your documents stay on this device.");

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + (file.size ?? 0), 0), [files]);

  async function pickPdfs() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: true,
        copyToCacheDirectory: true
      });
      if (result.canceled) return;

      const newFiles: PickedPdf[] = result.assets
        .filter((asset) => asset.name.toLowerCase().endsWith(".pdf") || asset.mimeType === "application/pdf")
        .map((asset) => ({
          id: `${asset.uri}-${asset.name}`,
          name: asset.name,
          uri: asset.uri,
          size: asset.size
        }));

      if (newFiles.length === 0) {
        setStatus("No PDF files were selected. Please choose PDF documents.");
        return;
      }

      setFiles((current) => {
        const seen = new Set(current.map((file) => file.uri));
        return [...current, ...newFiles.filter((file) => !seen.has(file.uri))];
      });
      setStatus(`${newFiles.length} PDF file(s) added.`);
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

  async function merge() {
    if (files.length < 2) {
      setStatus("Please select at least two PDF files.");
      return;
    }

    setBusy(true);
    setStatus("Reading and merging your PDFs…");
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
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>G</Text></View>
        <Text style={styles.brand}>Gattai<Text style={styles.brandLight}>Mate</Text></Text>
        <View style={styles.privacyPill}><View style={styles.greenDot} /><Text style={styles.privacyText}>Private</Text></View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>YOUR DOCUMENTS, TOGETHER</Text>
        <Text style={styles.title}>One file.{`\n`}<Text style={styles.titleAccent}>All in harmony.</Text></Text>
        <Text style={styles.subtitle}>Merge PDFs on your phone. Your documents stay on your device.</Text>
      </View>

      <View style={styles.sectionHeader}>
        <View><Text style={styles.sectionTitle}>Your workspace</Text><Text style={styles.muted}>Arrange files in the order you need.</Text></View>
        <Text style={styles.count}>{files.length} files</Text>
      </View>

      <Pressable style={styles.pickCard} onPress={() => void pickPdfs()}>
        <View style={styles.uploadBadge}><Text style={styles.uploadGlyph}>↑</Text></View>
        <Text style={styles.pickTitle}>Choose PDF files</Text>
        <Text style={styles.muted}>Select one or more documents</Text>
        <View style={styles.pickButton}><Text style={styles.pickButtonText}>Browse documents  +</Text></View>
      </Pressable>

      {files.length > 0 && (
        <View style={styles.filePanel}>
          <View style={styles.filePanelHeader}>
            <Text style={styles.panelTitle}>Selected documents</Text>
            <Pressable onPress={() => { setFiles([]); setStatus("Selection cleared."); }}><Text style={styles.clearText}>Clear all</Text></Pressable>
          </View>
          {files.map((file, index) => (
            <View style={styles.fileRow} key={file.id}>
              <View style={styles.pdfBadge}><Text style={styles.pdfBadgeText}>PDF</Text></View>
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
          <Pressable style={styles.addMore} onPress={() => void pickPdfs()}><Text style={styles.addMoreText}>+ Add more PDFs</Text></Pressable>
        </View>
      )}

      <View style={styles.mergePanel}>
        <Text style={styles.panelTitle}>Create your merged PDF</Text>
        <Text style={styles.muted}>Original documents will not be changed.</Text>
        <Text style={styles.inputLabel}>OUTPUT FILE NAME</Text>
        <TextInput value={outputName} onChangeText={setOutputName} style={styles.input} autoCapitalize="none" maxLength={100} />
        <View style={styles.summary}><Text style={styles.summaryText}>{files.length} files</Text><Text style={styles.summaryText}>{formatBytes(totalSize)}</Text></View>
        <Pressable disabled={busy || files.length < 2} style={[styles.mergeButton, (busy || files.length < 2) && styles.disabled]} onPress={() => void merge()}>
          {busy ? <ActivityIndicator color="#171326" /> : <Text style={styles.mergeButtonText}>Merge PDFs  ↗</Text>}
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
  fileDetails: { flex: 1, minWidth: 0 },
  fileName: { color: "#F0EFF9", fontSize: 11, fontWeight: "600" },
  fileMeta: { color: "#8E8EA5", fontSize: 10, marginTop: 5 },
  controls: { flexDirection: "row", alignItems: "center", gap: 4 },
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
  footer: { color: "#77778D", fontSize: 10, textAlign: "center", marginTop: 28 }
});
