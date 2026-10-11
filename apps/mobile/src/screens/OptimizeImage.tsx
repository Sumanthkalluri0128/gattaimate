import { useState } from "react";
import { Text } from "react-native";
import { baseName, formatBytes, withExtension } from "@gattaimate/pdf-core";
import FileTool from "../FileTool";
import { fileSize } from "../files";
import { optimizeImage } from "../images";
import { Segmented, Stepper, s } from "../ui";

const SIZES = [{ value: 0, label: "Original" }, { value: 2400, label: "2400" }, { value: 1600, label: "1600" }, { value: 1200, label: "1200" }];

export default function OptimizeImage() {
  const [quality, setQuality] = useState(78);
  const [maxSide, setMaxSide] = useState(2400);
  return (
    <FileTool id="optimize-image" kind="image" actionLabel="Optimize & share"
      options={() => (<>
        <Stepper label="JPEG quality" value={quality} min={35} max={95} step={5} onChange={setQuality} format={(v) => `${v}%`} />
        <Segmented label="Longest side (px)" value={maxSide} onChange={setMaxSide} options={SIZES} />
        <Text style={s.hint}>Saved as JPG. PNG transparency becomes white. Smaller images are never enlarged.</Text>
      </>)}
      run={async ({ file }) => {
        const out = await optimizeImage(file.uri, quality, maxSide);
        const size = await fileSize(out.uri);
        return { name: withExtension(`${baseName(file.name)}-optimized`, ".jpg"), mime: "image/jpeg", uri: out.uri, size, pages: 1, before: file.size, message: `Saved ${out.width}×${out.height} JPG: ${formatBytes(file.size ?? 0)} → ${formatBytes(size)}.` };
      }} />
  );
}
