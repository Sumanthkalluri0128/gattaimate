import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { formatBytes, isPdfName } from "@gattaimate/pdf-core";
import { peekIncoming } from "../src/incoming";
import { Badge, Btn, Card, Empty, Heading, Screen, s } from "../src/ui";

const PDF_ACTIONS: { id: string; label: string }[] = [
  { id: "merge", label: "Merge with other files" }, { id: "split", label: "Split" }, { id: "organize", label: "Organize pages" },
  { id: "extract", label: "Extract pages" }, { id: "sign", label: "Sign" },
  { id: "forms", label: "Fill form" }, { id: "protect", label: "Protect with password" }, { id: "optimize-pdf", label: "Optimize" }
];
const IMAGE_ACTIONS = [{ id: "images", label: "Convert to PDF" }, { id: "optimize-image", label: "Optimize image" }];

/** Landing screen for files shared from another app: pick what to do with them. */
export default function Incoming() {
  const router = useRouter();
  const files = peekIncoming();
  const pdfs = files.filter((f) => isPdfName(f.name));
  const actions = pdfs.length ? PDF_ACTIONS : IMAGE_ACTIONS;

  const go = (id: string) => {
    if (id === "merge") router.replace("/merge");
    else if (id === "images") router.replace({ pathname: "/merge", params: { mode: "images" } });
    else router.replace({ pathname: "/tool/[id]", params: { id } });
  };

  return (
    <Screen>
      <Heading title="Shared with GattaiMate" blurb="Choose what to do with these files." color="#A998FF" />
      {files.length === 0 ? <Empty title="No files received" text="Share a PDF or image from another app and choose GattaiMate." /> : (
        <>
          <Card>
            {files.map((file) => (
              <View key={file.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Badge label={isPdfName(file.name) ? "PDF" : "IMG"} tone={isPdfName(file.name) ? undefined : "image"} />
                <View style={{ flex: 1 }}><Text style={s.fileName} numberOfLines={1}>{file.name}</Text><Text style={s.meta}>{file.size ? formatBytes(file.size) : "—"}</Text></View>
              </View>
            ))}
          </Card>
          <Card accent>{actions.map((action) => <Btn key={action.id} variant="secondary" label={action.label} onPress={() => go(action.id)} />)}</Card>
        </>
      )}
    </Screen>
  );
}
