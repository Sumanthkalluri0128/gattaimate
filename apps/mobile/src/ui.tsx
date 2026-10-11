import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./theme";

export type NoticeState = { kind: "success" | "error" | "info"; text: string } | null;

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{children}</ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return <View style={[s.card, accent && s.cardAccent]}>{children}</View>;
}

export function Heading({ title, blurb, color }: { title: string; blurb?: string; color?: string }) {
  return (
    <View style={s.heading}>
      {color && <View style={[s.headingDot, { backgroundColor: color }]} />}
      <View style={{ flex: 1 }}>
        <Text style={s.h1}>{title}</Text>
        {blurb ? <Text style={s.muted}>{blurb}</Text> : null}
      </View>
    </View>
  );
}

type BtnProps = { label: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost"; busy?: boolean; disabled?: boolean; small?: boolean };
export function Btn({ label, onPress, variant = "primary", busy, disabled, small }: BtnProps) {
  const off = disabled || busy;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={off} onPress={onPress}
      style={({ pressed }) => [s.btn, small && s.btnSmall, variant === "primary" && s.btnPrimary, variant === "secondary" && s.btnSecondary, variant === "ghost" && s.btnGhost, off && s.off, pressed && { opacity: 0.8 }]}>
      {busy ? <ActivityIndicator color={variant === "primary" ? colors.accentDark : colors.accent} /> : <Text style={[s.btnText, variant !== "primary" && { color: colors.accent }]}>{label}</Text>}
    </Pressable>
  );
}

export function IconBtn({ label, glyph, onPress, disabled }: { label: string; glyph: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={4} style={[s.iconBtn, disabled && s.off]}>
      <Text style={s.iconBtnText}>{glyph}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...input }: { label: string; hint?: string } & TextInputProps) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      <TextInput placeholderTextColor="#6C6C86" autoCapitalize="none" autoCorrect={false} style={s.input} {...input} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: { label?: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <View style={s.field}>
      {label ? <Text style={s.label}>{label.toUpperCase()}</Text> : null}
      <View style={s.segmented}>
        {options.map((option) => (
          <Pressable key={String(option.value)} accessibilityRole="radio" accessibilityState={{ selected: option.value === value }} onPress={() => onChange(option.value)} style={[s.segment, option.value === value && s.segmentOn]}>
            <Text style={[s.segmentText, option.value === value && { color: colors.text }]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Stepper({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; format?: (value: number) => string }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      <View style={s.stepper}>
        <IconBtn label={`Decrease ${label}`} glyph="−" disabled={value <= min} onPress={() => onChange(Math.max(min, value - step))} />
        <Text style={s.stepperValue}>{format ? format(value) : value}</Text>
        <IconBtn label={`Increase ${label}`} glyph="+" disabled={value >= max} onPress={() => onChange(Math.min(max, value + step))} />
      </View>
    </View>
  );
}

export function Notice({ notice }: { notice: NoticeState }) {
  if (!notice) return null;
  const tone = notice.kind === "success" ? s.noticeOk : notice.kind === "error" ? s.noticeErr : null;
  return <View accessibilityLiveRegion="polite" style={[s.notice, tone]}><Text style={s.noticeText}>{notice.text}</Text></View>;
}

export function Badge({ label, tone }: { label: string; tone?: "image" }) {
  return <View style={[s.badge, tone === "image" && s.badgeImage]}><Text style={[s.badgeText, tone === "image" && { color: "#73D8B2" }]}>{label}</Text></View>;
}

export function Empty({ title, text }: { title: string; text: string }) {
  return <View style={s.empty}><Text style={s.emptyTitle}>{title}</Text><Text style={s.muted}>{text}</Text></View>;
}

export function SizeBars({ before, after }: { before: number; after: number }) {
  const saved = Math.round((1 - after / before) * 100);
  const max = Math.max(before, after, 1);
  const row = (label: string, value: number, color: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={[s.meta, { width: 46 }]}>{label}</Text>
      <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: "#FFFFFF14", overflow: "hidden" }}><View style={{ width: `${(value / max) * 100}%`, height: 10, borderRadius: 5, backgroundColor: color }} /></View>
      <Text style={[s.meta, { width: 62, textAlign: "right" }]}>{value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`}</Text>
    </View>
  );
  return (
    <Card>
      {row("Before", before, "#8C73FF")}
      {row("After", after, saved > 0 ? "#3FD5A5" : "#FF7A8A")}
      <Text style={{ color: saved > 0 ? colors.success : colors.muted, fontWeight: "700", fontSize: 13 }}>{saved > 0 ? `${saved}% smaller` : saved < 0 ? `${-saved}% larger` : "Same size"}</Text>
    </Card>
  );
}

export const textStyles = { muted: () => s.muted, h2: () => s.h2, fileName: () => s.fileName, meta: () => s.meta };

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  card: { padding: 14, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  cardAccent: { backgroundColor: "#242039", borderColor: "#8172BD55" },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  headingDot: { width: 6, alignSelf: "stretch", borderRadius: 3 },
  h1: { color: colors.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  h2: { color: colors.text, fontSize: 16, fontWeight: "700" },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  btn: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  btnSmall: { minHeight: 38, borderRadius: 10, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: colors.accent },
  btnSecondary: { backgroundColor: "#29263C", borderWidth: 1, borderColor: "#4D4768" },
  btnGhost: { backgroundColor: "transparent" },
  btnText: { color: colors.accentDark, fontWeight: "800", fontSize: 14 },
  off: { opacity: 0.38 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#39364F", backgroundColor: "#211F31", alignItems: "center", justifyContent: "center" },
  iconBtnText: { color: "#E0DCF8", fontSize: 17 },
  field: { gap: 7 },
  label: { color: "#9291A9", fontSize: 10, letterSpacing: 1.2, fontWeight: "700" },
  input: { minHeight: 48, color: colors.text, backgroundColor: "#141421", borderWidth: 1, borderColor: "#444057", borderRadius: 10, paddingHorizontal: 13, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  segmented: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: "#39364F", backgroundColor: "#141421" },
  segment: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segmentOn: { backgroundColor: "#A998FF2E", borderWidth: 1, borderColor: "#A998FF77" },
  segmentText: { color: "#B4B3C9", fontSize: 12, fontWeight: "700", textAlign: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepperValue: { color: colors.text, fontSize: 16, fontWeight: "700", minWidth: 70, textAlign: "center" },
  notice: { padding: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: "#FFFFFF08" },
  noticeOk: { borderColor: "#36D6B355", backgroundColor: "#12302E88" },
  noticeErr: { borderColor: "#FF7A8A55", backgroundColor: "#3A1620AA" },
  noticeText: { color: "#E3E0F2", fontSize: 13, lineHeight: 19 },
  badge: { width: 40, height: 44, borderRadius: 9, backgroundColor: "#ED7E8B18", alignItems: "center", justifyContent: "center" },
  badgeImage: { backgroundColor: "#73D8B218" },
  badgeText: { color: "#F49CA6", fontSize: 10, fontWeight: "800" },
  empty: { padding: 16, gap: 4, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "#A998FF30", backgroundColor: "#111629" },
  emptyTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  fileName: { color: colors.text, fontSize: 13, fontWeight: "600" },
  meta: { color: "#8E8EA5", fontSize: 11 }
});
