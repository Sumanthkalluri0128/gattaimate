import type { ComponentType } from "react";
import { useLocalSearchParams } from "expo-router";
import Extract from "../../src/screens/Extract";
import Forms from "../../src/screens/Forms";
import OptimizeImage from "../../src/screens/OptimizeImage";
import OptimizePdf from "../../src/screens/OptimizePdf";
import Organize from "../../src/screens/Organize";
import Protect from "../../src/screens/Protect";
import Rotate from "../../src/screens/Rotate";
import Sign from "../../src/screens/Sign";
import Split from "../../src/screens/Split";
import Stamp from "../../src/screens/Stamp";
import { Heading, Screen } from "../../src/ui";

const SCREENS: Record<string, ComponentType> = {
  split: Split, extract: Extract, rotate: Rotate, organize: Organize, stamp: Stamp, sign: Sign,
  forms: Forms, protect: Protect, "optimize-pdf": OptimizePdf, "optimize-image": OptimizeImage
};

export default function ToolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const Tool = SCREENS[id ?? ""];
  return Tool ? <Tool /> : <Screen><Heading title="Tool not found" /></Screen>;
}
