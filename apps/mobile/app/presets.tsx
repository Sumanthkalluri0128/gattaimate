import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  BUILT_IN_PRESETS, baseName, describeStep, formatBytes, runPipeline, withExtension, zipFiles, type NamedBytes, type PipelineStep, type Preset
} from "@gattaimate/pdf-core";
import { pickFiles, readBytes, saveAndShare, type Picked } from "../src/files";
import { usePresets } from "../src/presetStore";
import { useRecent } from "../src/recent";
import { colors } from "../src/theme";
import { Btn, Card, Field, Heading, IconBtn, Notice, Screen, Segmented, s, type NoticeState } from "../src/ui";

function Builder({ onSave }: { onSave: (preset: Preset) => void }) {
  const [name, setName] = useState("");
  const [clean, setClean] = useState(true);
  const [rotate, setRotate] = useState(false);
  const [lock, setLock] = useState(false);
  const [error, setError] = useState("");
  const onOff = (value: boolean, set: (v: boolean) => void, label: string) =>
    <Segmented label={label} value={value ? "on" : "off"} onChange={(v) => set(v === "on")} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />;

  function save() {
    const steps: PipelineStep[] = [];
    if (clean) steps.push({ op: "optimize" });
    if (rotate) steps.push({ op: "rotate", angle: 90 });
    if (lock) steps.push({ op: "protect", password: "" });
    if (!name.trim()) return setError("Give the preset a name.");
    if (steps.length === 0) return setError("Pick at least one step.");
    setError("");
    onSave({ id: `custom-${Date.now()}`, name: name.trim(), description: steps.map(describeStep).join(" → "), steps });
    setName("");
  }
  return (
    <View style={{ gap: 12 }}>
      <Field label="Preset name" value={name} onChangeText={setName} maxLength={40} placeholder="Monthly invoices" />
      {onOff(clean, setClean, "Optimize & clear metadata")}
      {onOff(rotate, setRotate, "Rotate all pages 90° right")}
      {onOff(lock, setLock, "Password-protect (asked each run)")}
      {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      <Btn variant="secondary" label="Save preset" onPress={save} />
    </View>
  );
}

export default function PresetsScreen() {
  const recent = useRecent();
  const { custom, add, remove } = usePresets();
  const presets: Preset[] = [...BUILT_IN_PRESETS, ...custom];
  const [selectedId, setSelectedId] = useState(BUILT_IN_PRESETS[0].id);
  const [files, setFiles] = useState<Picked[]>([]);
  const [password, setPassword] = useState("");
  const [building, setBuilding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const preset = presets.find((p) => p.id === selectedId) ?? presets[0];
  const needsPassword = preset.steps.some((step) => step.op === "protect");

  async function choose() {
    const { files: picked, rejected } = await pickFiles("pdf", true);
    if (rejected) setNotice({ kind: "info", text: `Skipped ${rejected} non-PDF file(s).` });
    setFiles((cur) => [...cur, ...picked]);
  }

  async function run() {
    if (busy || files.length === 0) return;
    if (needsPassword && password.length < 4) { setNotice({ kind: "error", text: "Enter a password of at least 4 characters for this preset." }); return; }
    setBusy(true);
    const steps = preset.steps.map((step) => (step.op === "protect" ? { ...step, password } : step));
    const outputs: NamedBytes[] = [], failures: string[] = [], notes = new Set<string>();
    let pages = 0;
    for (const [index, file] of files.entries()) {
      setNotice({ kind: "info", text: `File ${index + 1} of ${files.length}: ${file.name}` });
      try {
        const result = await runPipeline(await readBytes(file.uri), steps);
        result.notes.forEach((n) => notes.add(n));
        pages += result.pageCount;
        outputs.push({ name: withExtension(`${baseName(file.name)}-${preset.id.startsWith("custom") ? "processed" : preset.id}`, ".pdf"), bytes: result.bytes });
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
    try {
      if (outputs.length === 0) throw new Error(failures[0] ?? "Nothing was produced.");
      const single = outputs.length === 1;
      const name = single ? outputs[0].name : "gattaimate-batch.zip";
      const saved = await saveAndShare(single ? outputs[0].bytes : zipFiles(outputs), name, single ? "application/pdf" : "application/zip");
      recent.add({ name, tool: `Preset · ${preset.name}`, pages, size: saved.size });
      const extra = [...notes, ...failures.map((f) => `Failed — ${f}`)].join(" ");
      setNotice({ kind: failures.length ? "info" : "success", text: `“${preset.name}” processed ${outputs.length} of ${files.length} file${files.length === 1 ? "" : "s"} → ${name} (${formatBytes(saved.size)}). ${extra}`.trim() });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "The batch failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Heading title="Presets & Batch" blurb="Pick a recipe, add one or many PDFs, get one result — or a ZIP for many." color="#A3E635" />
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={s.h2}>1 · Choose a preset</Text>
          <Btn variant="ghost" small label={building ? "Close" : "+ New"} onPress={() => setBuilding((v) => !v)} />
        </View>
        {building && <Builder onSave={(p) => { add(p); setSelectedId(p.id); setBuilding(false); }} />}
        {presets.map((p) => (
          <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: p.id === preset.id }} onPress={() => setSelectedId(p.id)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: p.id === preset.id ? colors.accent : "#FFFFFF14", backgroundColor: p.id === preset.id ? "#A998FF14" : "transparent" }}>
            <View style={{ flex: 1 }}><Text style={s.fileName}>{p.name}</Text><Text style={s.meta}>{p.description}</Text></View>
            {!p.builtIn && <IconBtn label={`Delete preset ${p.name}`} glyph="×" onPress={() => { remove(p.id); if (selectedId === p.id) setSelectedId(BUILT_IN_PRESETS[0].id); }} />}
          </Pressable>
        ))}
        {preset.steps.some((step) => step.op === "shrink") && <Text style={s.hint}>Note: “Shrink” needs the web app, so on your phone this preset only cleans metadata.</Text>}
      </Card>

      <Btn variant="secondary" label={files.length ? "+ Add more PDFs" : "2 · Choose PDFs"} onPress={() => void choose()} disabled={busy} />
      {files.length > 0 && (
        <Card accent>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={s.h2}>{files.length} file{files.length === 1 ? "" : "s"}</Text>
            <Btn variant="ghost" small label="Clear" onPress={() => setFiles([])} disabled={busy} />
          </View>
          {files.map((f) => <Text key={f.id} style={s.fileName} numberOfLines={1}>{f.name}</Text>)}
          {needsPassword && <Field label="Password for the protected copies" value={password} onChangeText={setPassword} secureTextEntry />}
          <Btn label={`Run “${preset.name}”`} onPress={() => void run()} busy={busy} />
        </Card>
      )}
      <Notice notice={notice} />
    </Screen>
  );
}
