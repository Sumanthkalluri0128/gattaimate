import { useRef, useState } from "react";
import { Text } from "react-native";
import { addSignature, baseName, withExtension, type SignatureOptions } from "@gattaimate/pdf-core";
import FileTool from "../FileTool";
import { pickFiles, readBytes } from "../files";
import { Btn, Field, Segmented, Stepper, s } from "../ui";

type Spec = Pick<SignatureOptions, "pageIndex" | "x" | "y" | "width" | "image" | "text">;
const ROWS = [0.06, 0.45, 0.85];

function Editor({ pageCount, onSpec }: { pageCount: number; onSpec: (spec: Spec | null) => void }) {
  const [tab, setTab] = useState<"type" | "image">("type");
  const [text, setText] = useState("");
  const [image, setImage] = useState<Uint8Array | null>(null);
  const [imageName, setImageName] = useState("");
  const [page, setPage] = useState(1);
  const [col, setCol] = useState(2);
  const [row, setRow] = useState(2);
  const [size, setSize] = useState(30);

  const width = size / 100;
  const typed = tab === "type" ? text.trim() : "";
  const img = tab === "image" ? image : null;
  onSpec(typed || img ? { pageIndex: page - 1, x: (col * (1 - width)) / 2, y: ROWS[row], width, text: typed || undefined, image: img ?? undefined } : null);

  return (
    <>
      <Segmented value={tab} onChange={setTab} options={[{ value: "type", label: "Type name" }, { value: "image", label: "Signature image" }]} />
      {tab === "type" ? <Field label="Your name" value={text} onChangeText={setText} maxLength={40} placeholder="Jane Doe" hint="Shown in an italic script-style font. Latin letters only." />
        : (<>
            <Btn variant="secondary" small label={imageName ? `Image: ${imageName}` : "Choose a PNG/JPG of your signature"} onPress={async () => { const { files } = await pickFiles("image", false); if (files[0]) { setImage(await readBytes(files[0].uri)); setImageName(files[0].name); } }} />
            <Text style={s.hint}>A PNG with a transparent background looks best.</Text>
          </>)}
      <Stepper label="Page" value={page} min={1} max={pageCount} step={1} onChange={setPage} />
      <Segmented label="Horizontal" value={col} onChange={setCol} options={[{ value: 0, label: "Left" }, { value: 1, label: "Center" }, { value: 2, label: "Right" }]} />
      <Segmented label="Vertical" value={row} onChange={setRow} options={[{ value: 0, label: "Top" }, { value: 1, label: "Middle" }, { value: 2, label: "Bottom" }]} />
      <Stepper label="Size (% of page width)" value={size} min={10} max={60} step={5} onChange={setSize} format={(v) => `${v}%`} />
    </>
  );
}

export default function Sign() {
  const spec = useRef<Spec | null>(null);
  return (
    <FileTool id="sign" kind="pdf" actionLabel="Sign & share"
      options={({ file, pageCount }) => pageCount ? <Editor key={file.id} pageCount={pageCount} onSpec={(v) => { spec.current = v; }} /> : null}
      run={async ({ file, bytes }) => {
        if (!spec.current) throw new Error("Type your name or choose a signature image first.");
        const out = await addSignature(await bytes(), spec.current);
        return { name: withExtension(`${baseName(file.name)}-signed`, ".pdf"), mime: "application/pdf", bytes: out.bytes, pages: out.pageCount, message: `Signed page ${spec.current.pageIndex + 1}. This is a visual signature, not a certificate-based digital signature.` };
      }} />
  );
}
