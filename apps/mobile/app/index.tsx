import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { formatBytes } from "@gattaimate/pdf-core";
import { TOOLS, type ToolId } from "../src/tools";
import { timeAgo, useRecent } from "../src/recent";
import { colors } from "../src/theme";
import { Badge, Empty, s } from "../src/ui";

export default function HomeScreen() {
  const router = useRouter();
  const { items } = useRecent();

  const open = (id: ToolId) => {
    if (id === "merge") router.push("/merge");
    else if (id === "images" || id === "scan") router.push({ pathname: "/merge", params: { mode: id } });
    else if (id === "presets") router.push("/presets");
    else router.push({ pathname: "/tool/[id]", params: { id } });
  };

  return (
    <SafeAreaView style={s.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={[s.content, { gap: 22 }]}>
        <View style={st.topbar}>
          <Image source={require("../assets/icon.png")} style={st.logo} />
          <View style={{ flex: 1 }}>
            <Text style={st.brand}>Gattai<Text style={{ color: "#D17CFF" }}>Mate</Text></Text>
            <Text style={s.muted}>All your documents. One app.</Text>
          </View>
          <View style={st.pill}><View style={st.dot} /><Text style={st.pillText}>Private</Text></View>
        </View>

        <View>
          <Text style={st.eyebrow}>FAST · PRIVATE · OFFLINE</Text>
          <Text style={st.title}>Complete{"\n"}<Text style={{ color: colors.accent }}>PDF Toolkit</Text></Text>
          <Text style={[s.muted, { marginTop: 8, maxWidth: 320 }]}>Everything runs on your phone. Nothing is uploaded.</Text>
        </View>

        <View style={st.grid}>
          {TOOLS.map((tool) => (
            <Pressable key={tool.id} accessibilityRole="button" accessibilityLabel={`${tool.title}. ${tool.blurb}`} onPress={() => open(tool.id)}
              style={({ pressed }) => [st.tool, { borderColor: `${tool.color}55` }, pressed && { opacity: 0.8 }]}>
              <View style={[st.glyphBox, { backgroundColor: `${tool.color}25` }]}><Text style={[st.glyph, { color: tool.color }]}>{tool.glyph}</Text></View>
              <Text style={st.toolTitle}>{tool.title}</Text>
              <Text style={s.muted}>{tool.blurb}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <View style={st.rowBetween}>
            <Text style={s.h2}>Recent files</Text>
            {items.length > 0 && <Pressable onPress={() => router.push("/recent")} hitSlop={8}><Text style={st.link}>See all</Text></Pressable>}
          </View>
          {items.length === 0 ? <Empty title="Nothing yet" text="PDFs you create will be listed here. Only names and sizes are remembered." /> : items.slice(0, 3).map((item) => (
            <View key={item.id} style={st.recent}>
              <Badge label={/\.zip$/i.test(item.name) ? "ZIP" : /\.(jpe?g|png)$/i.test(item.name) ? "IMG" : "PDF"} />
              <View style={{ flex: 1 }}>
                <Text style={s.fileName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.meta}>{item.tool} · {formatBytes(item.size)} · {timeAgo(item.at)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  topbar: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: { width: 40, height: 40, borderRadius: 12 },
  brand: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.6 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#FFFFFF1A", borderRadius: 30, paddingVertical: 7, paddingHorizontal: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#73D8B2" },
  pillText: { color: "#D0CFE0", fontSize: 11 },
  eyebrow: { color: "#B7AAFF", fontSize: 10, letterSpacing: 1.8, fontWeight: "700" },
  title: { color: colors.text, fontSize: 38, lineHeight: 42, fontWeight: "900", letterSpacing: -1.6, marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tool: { width: "48.5%", minHeight: 128, padding: 13, gap: 4, borderRadius: 15, borderWidth: 1, backgroundColor: "#151629" },
  glyphBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  glyph: { fontSize: 22, fontWeight: "800" },
  toolTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  link: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  recent: { flexDirection: "row", alignItems: "center", gap: 12, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: "#111629" }
});
