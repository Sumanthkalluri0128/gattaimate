import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { baseName, fillForm, listFormFields, withExtension, type FormField, type FormFieldValue } from "@gattaimate/pdf-core";
import FileTool from "../FileTool";
import { readBytes } from "../files";
import { Field, Segmented, s } from "../ui";

type State = { values: Record<string, FormFieldValue>; flatten: boolean };

function Editor({ uri, onState }: { uri: string; onState: (state: State | null) => void }) {
  const [fields, setFields] = useState<FormField[] | null>(null);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, FormFieldValue>>({});
  const [flatten, setFlatten] = useState(false);

  useEffect(() => {
    let live = true;
    readBytes(uri).then(listFormFields).then((found) => { if (live) { setFields(found); setValues(Object.fromEntries(found.map((f) => [f.name, f.value]))); } })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : "Could not read this form."); });
    return () => { live = false; };
  }, [uri]);

  const editable = (fields ?? []).filter((f) => !f.readOnly);
  onState(editable.length ? { values, flatten } : null);

  if (error) return <Text style={{ color: "#FF7A8A" }}>{error}</Text>;
  if (!fields) return <Text style={s.muted}>Reading form…</Text>;
  if (editable.length === 0) return <Text style={s.muted}>No fillable fields found. This PDF isn’t an interactive form.</Text>;
  const set = (name: string, value: FormFieldValue) => setValues((cur) => ({ ...cur, [name]: value }));

  return (
    <>
      {editable.map((f) => f.type === "checkbox"
        ? <Segmented key={f.name} label={f.name} value={values[f.name] ? "yes" : "no"} onChange={(v) => set(f.name, v === "yes")} options={[{ value: "yes", label: "Checked" }, { value: "no", label: "Unchecked" }]} />
        : f.options && f.options.length <= 4
          ? <Segmented key={f.name} label={f.name} value={String(values[f.name] ?? "")} onChange={(v) => set(f.name, v)} options={f.options.map((o) => ({ value: o, label: o }))} />
          : <Field key={f.name} label={f.name} value={String(values[f.name] ?? "")} onChangeText={(v) => set(f.name, v)} hint={f.options ? `Options: ${f.options.join(", ")}` : undefined} />)}
      <Segmented label="Flatten (make permanent)" value={flatten ? "yes" : "no"} onChange={(v) => setFlatten(v === "yes")} options={[{ value: "no", label: "Keep editable" }, { value: "yes", label: "Flatten" }]} />
    </>
  );
}

export default function Forms() {
  const state = useRef<State | null>(null);
  return (
    <FileTool id="forms" kind="pdf" actionLabel="Save filled form"
      options={({ file }) => <Editor key={file.id} uri={file.uri} onState={(v) => { state.current = v; }} />}
      run={async ({ file, bytes }) => {
        if (!state.current) throw new Error("This PDF has no fillable fields.");
        const out = await fillForm(await bytes(), state.current.values, state.current.flatten);
        return { name: withExtension(`${baseName(file.name)}-filled`, ".pdf"), mime: "application/pdf", bytes: out.bytes, pages: out.pageCount, message: state.current.flatten ? "Saved a flattened copy." : "Saved. Fields are still editable." };
      }} />
  );
}
