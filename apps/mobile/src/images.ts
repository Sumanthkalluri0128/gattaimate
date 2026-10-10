import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { Rotation } from "@gattaimate/pdf-core";

/** Re-encode as JPEG, shrinking the longest side to `maxSide` (0 = keep size). PNG transparency is flattened. */
export async function optimizeImage(uri: string, quality: number, maxSide: number) {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const scale = maxSide ? Math.min(1, maxSide / Math.max(original.width, original.height)) : 1;
  const source = scale < 1
    ? await ImageManipulator.manipulate(original).resize(original.width >= original.height ? { width: Math.round(original.width * scale) } : { height: Math.round(original.height * scale) }).renderAsync()
    : original;
  const saved = await source.saveAsync({ format: SaveFormat.JPEG, compress: quality / 100 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export async function rotateImage(uri: string, rotation: Rotation, png: boolean) {
  const rotated = await ImageManipulator.manipulate(uri).rotate(rotation).renderAsync();
  const saved = await rotated.saveAsync({ format: png ? SaveFormat.PNG : SaveFormat.JPEG, compress: 0.92 });
  return { uri: saved.uri };
}
