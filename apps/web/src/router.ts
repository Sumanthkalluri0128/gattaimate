import { useEffect, useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};
const snapshot = () => window.location.hash.replace(/^#/, "") || "/";

/** Minimal hash router: "#/merge" → "/merge". Works on any static host with no server rewrites. */
export function useRoute(): string {
  const route = useSyncExternalStore(subscribe, snapshot, () => "/");
  useEffect(() => { window.scrollTo({ top: 0 }); }, [route]);
  return route;
}

export const href = (path: string) => `#${path}`;
