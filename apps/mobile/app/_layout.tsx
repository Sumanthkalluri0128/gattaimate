import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RecentProvider } from "../src/recent";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RecentProvider>
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
        </Stack>
      </RecentProvider>
    </SafeAreaProvider>
  );
}
