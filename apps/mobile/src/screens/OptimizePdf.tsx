import { baseName, formatBytes, optimizePdf, withExtension } from "@gattaimate/pdf-core";
import { Text } from "react-native";
import FileTool from "../FileTool";
import { s } from "../ui";

export default function OptimizePdf() {
  return (
    <FileTool id="optimize-pdf" kind="pdf" actionLabel="Optimize & share"
      options={() => <Text style={s.muted}>Rewrites the PDF more efficiently and clears title/author metadata. Text, links and forms are kept, so savings are often small. For big savings on scans, use the web app’s “Smaller file” mode.</Text>}
      run={async ({ file, bytes }) => {
        const data = await bytes();
        const out = await optimizePdf(data);
        return { name: withExtension(`${baseName(file.name)}-optimized`, ".pdf"), mime: "application/pdf", bytes: out.bytes, pages: out.pageCount, before: data.byteLength, message: `${formatBytes(data.byteLength)} → ${formatBytes(out.bytes.byteLength)}.` };
      }} />
  );
}
