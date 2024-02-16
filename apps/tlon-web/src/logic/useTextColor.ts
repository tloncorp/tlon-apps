import { useEffect, useState } from 'react';

import { useIsDark } from './useMedia';
import { isColor } from './utils';

type RGBValues = {
  r: number;
  g: number;
  b: number;
};

export function hexToRgb(hex: string): RGBValues | null {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  // eslint-disable-next-line no-param-reassign
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function getLuminance({ r, g, b }: RGBValues): number {
  const a = [r, g, b].map((v) => {
    // eslint-disable-next-line no-param-reassign
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function useTextColor(cover: string): string {
  const isDark = useIsDark();
  const [textColor, setTextColor] = useState<string>(
    isDark ? 'white' : 'black'
  );

  useEffect(() => {
    if (isColor(cover) && cover !== '0x0') {
      const luminance = getLuminance(hexToRgb(cover) as RGBValues);
      setTextColor(luminance > 0.5 ? 'black' : 'white');
      return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        console.error('Failed to get canvas context');
        return;
      }
      canvas.width = image.width;
      canvas.height = image.height;
      try {
        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );
        const { data } = imageData;
        let r = 0;
        let g = 0;
        let b = 0;

        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }

        r /= data.length / 4;
        g /= data.length / 4;
        b /= data.length / 4;

        const luminance = getLuminance({ r, g, b });
        setTextColor(luminance > 0.495 ? 'black' : 'white');
      } catch (e) {
        console.error('Error loading image:', e);
      }
    };

    image.onerror = () => {
      console.error('Failed to load image');
    };

    image.src = cover;
  }, [cover, isDark]);

  return textColor;
}
