import { useEffect, useRef, useState } from "react";
import { baseName, fillForm, listFormFields, withExtension, type FormField, type FormFieldValue } from "@gattaimate/pdf-core";
import SingleFileTool from "../components/SingleFileTool";
import { downloadBytes, errorMessage, readBytes } from "../lib/browser";

type State = { values: Record<string, FormFieldValue>; flatten: boolean };

function Editor({ file, onState }: { file: File; onState: (state: State | null) => void }) {
  const [fields, setFields] = useState<FormField[] | null>(null);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, FormFieldValue>>({});
  const [flatten, setFlatten] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const found = await listFormFields(await readBytes(file));
        if (!live) return;
        setFields(found);
        setValues(Object.fromEntries(found.map((f) => [f.name, f.value])));
      } catch (e) { if (live) setError(errorMessage(e, "Could not read this form.")); }
    })();
    return () => { live = false; };
  }, [file]);

  const editable = (fields ?? []).filter((f) => !f.readOnly);
  useEffect(() => { onState(editable.length ? { values, flatten } : null); });

  if (error) return <div className="notice notice-error" role="alert">{error}</div>;
  if (!fields) return <div className="loading"><span className="spinner" /> Reading form…</div>;
  if (editable.length === 0) return <div className="empty"><div><strong>No fillable fields found</strong><small>This PDF isn’t an interactive form. To type on a flat PDF, use Sign PDF with a typed text, or add text in another editor.</small></div></div>;

  const set = (name: string, value: FormFieldValue) => setValues((current) => ({ ...current, [name]: value }));
  return (
    <>
      <div className="form-fields">
        {editable.map((field) => (
          <div className="field" key={field.name}>
            {field.type === "checkbox" ? (
              <label className="check"><input type="checkbox" checked={values[field.name] === true} onChange={(e) => set(field.name, e.target.checked)} /> {field.name}</label>
            ) : (
              <>
                <label htmlFor={`f-${field.name}`}>{field.name}</label>
                {field.type === "dropdown" || field.type === "list" || field.type === "radio" ? (
                  <select id={`f-${field.name}`} value={String(values[field.name] ?? "")} onChange={(e) => set(field.name, e.target.value)}>
                    <option value="">—</option>
                    {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input id={`f-${field.name}`} value={String(values[field.name] ?? "")} onChange={(e) => set(field.name, e.target.value)} autoComplete="off" />
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <label className="check"><input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} /> Flatten (make the answers permanent and non-editable)</label>
    </>
  );
}

export default function FormsPage() {
  const state = useRef<State | null>(null);
  return (
    <SingleFileTool
      id="forms"
      accept="pdf"
      actionLabel="Save filled form"
      options={({ file }) => <Editor key={`${file.name}-${file.size}-${file.lastModified}`} file={file} onState={(s) => { state.current = s; }} />}
      run={async ({ file, bytes }) => {
        if (!state.current) throw new Error("This PDF has no fillable fields.");
        const out = await fillForm(await bytes(), state.current.values, state.current.flatten);
        const name = withExtension(`${baseName(file.name)}-filled`, ".pdf");
        const size = downloadBytes(out.bytes, name);
        return { message: `Saved ${name}${state.current.flatten ? " (flattened)" : ". Fields are still editable"}.`, name, size, pages: out.pageCount };
      }}
    />
  );
}
