import { View, Text } from "react-native";
import { formatBytes } from "@gattaimate/pdf-core";
import { timeAgo, useRecent } from "../src/recent";
import { Badge, Btn, Card, Empty, Heading, Screen, s } from "../src/ui";

export default function RecentScreen() {
  const { items, clear } = useRecent();
  return (
    <Screen>
      <Heading title="Recent files" blurb="Only names, sizes and times are saved on this device — never the documents." color="#A998FF" />
      {items.length === 0 ? <Empty title="Nothing here yet" text="Create a PDF with any tool and it will be listed here." /> : (
        <Card>
          {items.map((item) => (
            <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Badge label={/\.zip$/i.test(item.name) ? "ZIP" : /\.(jpe?g|png)$/i.test(item.name) ? "IMG" : "PDF"} />
              <View style={{ flex: 1 }}>
                <Text style={s.fileName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.meta}>{item.tool}{item.pages ? ` · ${item.pages} ${item.pages === 1 ? "page" : "pages"}` : ""} · {formatBytes(item.size)} · {timeAgo(item.at)}</Text>
              </View>
            </View>
          ))}
          <Btn variant="secondary" small label="Clear history" onPress={clear} />
        </Card>
      )}
    </Screen>
  );
}
