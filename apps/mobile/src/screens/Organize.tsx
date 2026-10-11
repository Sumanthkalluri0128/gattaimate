import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { baseName, organizePdf, withExtension, type PagePlan } from "@gattaimate/pdf-core";
import FileTool from "../FileTool";
import { Btn, IconBtn, s } from "../ui";

type Tile = { id: number; page: number; rotation: number; removed: boolean };

function Editor({ count, onPlan }: { count: number; onPlan: (plan: PagePlan[]) => void }) {
  const make = () => Array.from({ length: count }, (_, i) => ({ id: i, page: i, rotation: 0, removed: false }));
  const nextId = useRef(count);
  const [tiles, setTiles] = useState<Tile[]>(make);
  useEffect(() => { onPlan(tiles.filter((t) => !t.removed).map((t) => ({ page: t.page, rotation: t.rotation }))); }, [tiles, onPlan]);

  const patch = (id: number, change: Partial<Tile>) => setTiles((cur) => cur.map((t) => (t.id === id ? { ...t, ...change } : t)));
  const move = (from: number, to: number) => setTiles((cur) => { if (to < 0 || to >= cur.length) return cur; const next = [...cur]; next.splice(to, 0, next.splice(from, 1)[0]); return next; });
  const dup = (i: number) => setTiles((cur) => { const next = [...cur]; next.splice(i + 1, 0, { ...cur[i], id: nextId.current++, removed: false }); return next; });
  const kept = tiles.filter((t) => !t.removed).length;

  return (
    <>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={s.meta}>{kept} of {tiles.length} pages kept</Text>
        <Btn variant="ghost" small label="Reset" onPress={() => setTiles(make())} />
      </View>
      {tiles.map((tile, index) => (
        <View key={tile.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: "#FFFFFF12", opacity: tile.removed ? 0.4 : 1 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.fileName}>{tile.removed ? "Removed" : `Page ${tile.page + 1}`}</Text>
            {tile.rotation ? <Text style={s.meta}>↻ {tile.rotation}°</Text> : null}
          </View>
          <IconBtn label={`Rotate page ${tile.page + 1}`} glyph="↻" onPress={() => patch(tile.id, { rotation: (tile.rotation + 90) % 360 })} />
          <IconBtn label="Move up" glyph="↑" disabled={index === 0} onPress={() => move(index, index - 1)} />
          <IconBtn label="Move down" glyph="↓" disabled={index === tiles.length - 1} onPress={() => move(index, index + 1)} />
          <IconBtn label={`Duplicate page ${tile.page + 1}`} glyph="⧉" onPress={() => dup(index)} />
          <IconBtn label={tile.removed ? "Restore page" : `Delete page ${tile.page + 1}`} glyph={tile.removed ? "↺" : "×"} onPress={() => patch(tile.id, { removed: !tile.removed })} />
        </View>
      ))}
    </>
  );
}

export default function Organize() {
  const plan = useRef<PagePlan[]>([]);
  return (
    <FileTool id="organize" kind="pdf" actionLabel="Save organized PDF"
      options={({ file, pageCount }) => pageCount ? <Editor key={file.id} count={pageCount} onPlan={(p) => { plan.current = p; }} /> : null}
      run={async ({ file, bytes }) => {
        const out = await organizePdf(await bytes(), plan.current);
        return { name: withExtension(`${baseName(file.name)}-organized`, ".pdf"), mime: "application/pdf", bytes: out.bytes, pages: out.pageCount, message: `Saved ${out.pageCount} page${out.pageCount === 1 ? "" : "s"}.` };
      }} />
  );
}
