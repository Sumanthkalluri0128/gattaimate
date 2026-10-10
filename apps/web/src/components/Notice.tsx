export type NoticeState = { kind: "success" | "error" | "info"; text: string } | null;

export default function Notice({ notice }: { notice: NoticeState }) {
  if (!notice) return null;
  return (
    <div className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
      {notice.text}
    </div>
  );
}
