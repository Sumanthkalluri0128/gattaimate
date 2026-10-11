import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setIncoming } from "../src/incoming";
import { RecentProvider } from "../src/recent";
import { colors } from "../src/theme";

// expo-share-intent is a native module: it exists in the built APK / dev build but not in Expo Go,
// where importing it throws. Load it defensively so the rest of the app always works.
const Share: typeof import("expo-share-intent") | null = (() => {
  try { return require("expo-share-intent"); } catch { return null; }
})();

/** Android "Share → GattaiMate": stash the files and open the action picker. */
function ShareHandler() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = Share!.useShareIntentContext();
  useEffect(() => {
    if (!hasShareIntent) return;
    const files = (shareIntent.files ?? []).map((file) => ({ id: `${file.path}#${Math.random().toString(36).slice(2)}`, name: file.fileName, uri: file.path.startsWith("file://") || file.path.includes("://") ? file.path : `file://${file.path}`, size: file.size ?? undefined, mimeType: file.mimeType }));
    resetShareIntent();
    if (files.length === 0) return;
    setIncoming(files);
    router.push("/incoming");
  }, [hasShareIntent, shareIntent, resetShareIntent, router]);
  return null;
}

const ShareBoundary = ({ children }: { children: React.ReactNode }) =>
  Share ? <Share.ShareIntentProvider>{children}</Share.ShareIntentProvider> : <>{children}</>;

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ShareBoundary>
      <RecentProvider>
        {Share && <ShareHandler />}
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "700" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg }
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="merge" options={{ title: "Merge PDF" }} />
          <Stack.Screen name="tool/[id]" options={{ title: "Tool" }} />
          <Stack.Screen name="recent" options={{ title: "Recent files" }} />
          <Stack.Screen name="presets" options={{ title: "Presets & Batch" }} />
          <Stack.Screen name="incoming" options={{ title: "Shared files" }} />
        </Stack>
      </RecentProvider>
      </ShareBoundary>
    </SafeAreaProvider>
  );
}
