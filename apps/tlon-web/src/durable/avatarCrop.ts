// The avatar's rounded square, from `AvatarFrame` (packages/app/ui/components/
// Avatar.tsx) and the web token scale in packages/ui/tamagui.config.ts: web
// uses the desktop measures, where `$4xl` is 44 with radius `$s` (6) and
// `$9xl` is 92 with radius `$xl` (14).
export const avatarSizes = [
  { size: 44, radius: 6 },
  { size: 92, radius: 14 },
] as const;
// Larger views keep the profile-sized (`$9xl`) corner.
export const avatarRadiusRatio = 14 / 92;

export const outputSize = 512;
export const maxZoom = 4;

// `x` and `y` place the image's top-left corner relative to the crop's, in
// crop pixels; `zoom` 1 is the smallest scale at which the image covers it.
export interface Crop {
  x: number;
  y: number;
  zoom: number;
}

export interface Size {
  width: number;
  height: number;
}

export function imageScale(image: Size, cropSize: number, zoom: number) {
  return (cropSize / Math.min(image.width, image.height)) * zoom;
}

// Keeps the image covering the crop: no empty space at any edge.
export function clampCrop(crop: Crop, image: Size, cropSize: number): Crop {
  const zoom = Math.min(maxZoom, Math.max(1, crop.zoom));
  const scale = imageScale(image, cropSize, zoom);
  const clamp = (value: number, length: number) =>
    Math.min(0, Math.max(cropSize - length * scale, value));
  return {
    zoom,
    x: clamp(crop.x, image.width),
    y: clamp(crop.y, image.height),
  };
}

export function centeredCrop(image: Size, cropSize: number): Crop {
  const scale = imageScale(image, cropSize, 1);
  return {
    zoom: 1,
    x: (cropSize - image.width * scale) / 2,
    y: (cropSize - image.height * scale) / 2,
  };
}

// Zooms keeping the image point under `focus` (crop pixels) in place.
export function zoomCrop(
  crop: Crop,
  zoom: number,
  focus: { x: number; y: number },
  image: Size,
  cropSize: number
): Crop {
  const next = Math.min(maxZoom, Math.max(1, zoom));
  const ratio = next / crop.zoom;
  return clampCrop(
    {
      zoom: next,
      x: focus.x - (focus.x - crop.x) * ratio,
      y: focus.y - (focus.y - crop.y) * ratio,
    },
    image,
    cropSize
  );
}

// The square of the source image, in its own pixels, that the crop shows.
export function sourceRect(crop: Crop, image: Size, cropSize: number) {
  const scale = imageScale(image, cropSize, crop.zoom);
  return {
    x: -crop.x / scale,
    y: -crop.y / scale,
    size: cropSize / scale,
  };
}
