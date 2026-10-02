import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// expo-image decodes straight to this size from its own cache, so a full-size
// photo never reaches JS, and every pixel left counts toward the average.
const SAMPLE_PX = 16;

/** The image's average color as an `rgb()` string, or null if it has none. */
export async function loadAverageImageColor(
  url: string
): Promise<string | null> {
  const sample = await Image.loadAsync(url, {
    maxWidth: SAMPLE_PX,
    maxHeight: SAMPLE_PX,
  });
  const rendered = await ImageManipulator.manipulate(sample).renderAsync();
  const { base64 } = await rendered.saveAsync({
    base64: true,
    format: SaveFormat.PNG,
  });
  if (!base64) {
    return null;
  }
  const decoded = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64));
  if (!decoded) {
    return null;
  }
  const pixels = decoded.readPixels(0, 0, {
    width: decoded.width(),
    height: decoded.height(),
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!(pixels instanceof Uint8Array)) {
    return null;
  }

  // Weight by alpha so a transparent background doesn't wash the color out.
  let red = 0;
  let green = 0;
  let blue = 0;
  let weight = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    red += pixels[i] * alpha;
    green += pixels[i + 1] * alpha;
    blue += pixels[i + 2] * alpha;
    weight += alpha;
  }
  if (weight === 0) {
    return null;
  }
  return `rgb(${Math.round(red / weight)}, ${Math.round(green / weight)}, ${Math.round(blue / weight)})`;
}
