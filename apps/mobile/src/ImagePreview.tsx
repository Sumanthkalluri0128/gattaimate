import { useState } from "react";
import { Image, Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Rotation } from "@gattaimate/pdf-core";
import { baseName, withExtension } from "@gattaimate/pdf-core";
import { fileSize, saveCopy, type Picked } from "./files";
import { rotateImage } from "./images";
import { useRecent } from "./recent";
import { colors } from "./theme";
import { Btn, Notice, s, type NoticeState } from "./ui";

/** Full-screen image preview with rotate and "save rotated copy". */
export default function ImagePreview({ file, onClose }: { file: Picked; onClose: () => void }) {
  const recent = useRecent();
  const [rotation, setRotation] = useState<Rotation>(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const png = /\.png$/i.test(file.name);
      const out = await rotateImage(file.uri, rotation, png);
      const name = withExtension(`${baseName(file.name)}-rotated`, png ? ".png" : ".jpg");
      const size = await fileSize(out.uri);
      const shared = await saveCopy(out.uri, png ? "image/png" : "image/jpeg", name);
      recent.add({ name, tool: "Rotate", pages: 1, size });
      setNotice({ kind: "success", text: shared ? "Rotated copy ready — choose where to save it." : "Saved to the app cache." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not save the rotated copy." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={[s.screen, { padding: 16, gap: 12 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={[s.h2, { flex: 1 }]} numberOfLines={1}>{file.name}</Text>
          <Btn variant="ghost" small label="Close" onPress={onClose} />
        </View>
        <View style={{ flex: 1, backgroundColor: "#0B0C16", borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
          <Image source={{ uri: file.uri }} resizeMode="contain" accessibilityLabel={file.name}
            style={{ width: "100%", height: "100%", transform: [{ rotate: `${rotation}deg` }] }} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Btn variant="secondary" small label="↶ Left" onPress={() => setRotation((r) => ((r + 270) % 360) as Rotation)} /></View>
          <View style={{ flex: 1 }}><Btn variant="secondary" small label="↻ Right" onPress={() => setRotation((r) => ((r + 90) % 360) as Rotation)} /></View>
        </View>
        <Btn label="Save rotated copy" onPress={() => void save()} busy={busy} disabled={rotation === 0} />
        <Text style={[s.meta, { textAlign: "center", color: colors.muted }]}>Your original file is never changed.</Text>
        <Notice notice={notice} />
      </SafeAreaView>
    </Modal>
  );
}
