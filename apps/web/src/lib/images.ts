import type { Rotation } from "@gattaimate/pdf-core";
import { baseName } from "@gattaimate/pdf-core";

export type DecodedImage = { source: CanvasImageSource; width: number; height: number; release: () => void };

/** Decode an image, applying its EXIF orientation so phone photos are upright. */
export async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      /* fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not open this image. It may be damaged."));
      element.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The browser could not encode the image."))), type, quality)
  );
}

function makeCanvas(width: number, height: number, opaque: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { alpha: !opaque });
  if (!context) throw new Error("Your browser could not create an image canvas.");
  return { canvas, context };
}

const freeCanvas = (canvas: HTMLCanvasElement) => { canvas.width = 0; canvas.height = 0; };

/** Export as a JPEG (PNG transparency becomes white), optionally scaling the longest side down to `maxSide`. */
export async function optimizeImage(file: File, quality: number, maxSide: number | null) {
  const image = await decodeImage(file);
  try {
    const scale = maxSide ? Math.min(1, maxSide / Math.max(image.width, image.height)) : 1;
    const { canvas, context } = makeCanvas(image.width * scale, image.height * scale, true);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, "image/jpeg", quality / 100);
    freeCanvas(canvas);
    return { blob, name: `${baseName(file.name)}-optimized.jpg`, width: Math.round(image.width * scale), height: Math.round(image.height * scale) };
  } finally {
    image.release();
  }
}

/** Draw an image rotated clockwise onto a canvas. Shared by the saved copy and the on-screen preview. */
export function drawRotated(
  image: DecodedImage, rotation: Rotation, maxSide: number
): { canvas: HTMLCanvasElement } {
  const sideways = rotation === 90 || rotation === 270;
  const outW = sideways ? image.height : image.width;
  const outH = sideways ? image.width : image.height;
  const scale = Math.min(1, maxSide / Math.max(outW, outH));
  const { canvas, context } = makeCanvas(outW * scale, outH * scale, false);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  context.drawImage(image.source, -drawW / 2, -drawH / 2, drawW, drawH);
  return { canvas };
}

/** Save a rotated copy, keeping PNGs as PNG so transparency survives. */
export async function rotateImageFile(file: File, rotation: Rotation) {
  const image = await decodeImage(file);
  try {
    const png = file.type === "image/png" || /\.png$/i.test(file.name);
    const { canvas } = drawRotated(image, rotation, Number.POSITIVE_INFINITY);
    const blob = await canvasToBlob(canvas, png ? "image/png" : "image/jpeg", 0.92);
    freeCanvas(canvas);
    return { blob, name: `${baseName(file.name)}-rotated.${png ? "png" : "jpg"}` };
  } finally {
    image.release();
  }
}
