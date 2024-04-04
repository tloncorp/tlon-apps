import { darken, lighten, parseToHsla } from 'color2k';
import { View } from 'tamagui';

export function foregroundFromBackground(
  background: string
): 'black' | 'white' {
  const rgb = {
    r: parseInt(background.slice(1, 3), 16),
    g: parseInt(background.slice(3, 5), 16),
    b: parseInt(background.slice(5, 7), 16),
  };
  const brightness = (299 * rgb.r + 587 * rgb.g + 114 * rgb.b) / 1000;
  const whiteBrightness = 255;

  return whiteBrightness - brightness < 70 ? 'black' : 'white';
}
export function themeAdjustColor(
  color: string,
  theme: 'light' | 'dark'
): string {
  const hsla = parseToHsla(color);
  const lightness = hsla[2];

  if (lightness <= 0.2 && theme === 'dark') {
    return lighten(color, 0.2 - lightness);
  }

  if (lightness >= 0.8 && theme === 'light') {
    return darken(color, lightness - 0.8);
  }

  return color;
}

export const UrbitSigilBase = View.styleable<{
  ship: string;
  adjustedColor: string;
}>(({ ship, adjustedColor, ...props }, ref) => {
  return (
    <View
      ref={ref}
      // TODO: Should be variables/props, not hardcoded values
      width={20}
      height={20}
      alignItems="center"
      justifyContent="center"
      style={{
        backgroundColor: adjustedColor,
      }}
      borderRadius="$2xs"
      {...props}
    >
      {props.children}
    </View>
  );
});
