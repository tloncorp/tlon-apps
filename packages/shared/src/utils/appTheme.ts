import type { AppThemeName } from '@tloncorp/api';

export const builtInThemeNames = [
  'light',
  'dark',
  'dracula',
  'greenscreen',
  'gruvbox',
  'monokai',
  'nord',
  'peony',
  'solarized',
] as const satisfies AppThemeName[];

export const themePreferenceNames = ['auto', ...builtInThemeNames] as const;

export const darkThemeNames = [
  'dark',
  'dracula',
  'greenscreen',
  'gruvbox',
  'monokai',
  'nord',
  'solarized',
] as const satisfies AppThemeName[];

export type CustomThemeName = `custom_${string}`;
export type ThemePreference =
  | (typeof themePreferenceNames)[number]
  | CustomThemeName;

export type BuiltInThemeOption = {
  title: string;
  value: AppThemeName;
};

export const builtInThemeOptions = [
  { title: 'Tlon Light', value: 'light' },
  { title: 'Tlon Dark', value: 'dark' },
  { title: 'Dracula', value: 'dracula' },
  { title: 'Greenscreen', value: 'greenscreen' },
  { title: 'Gruvbox', value: 'gruvbox' },
  { title: 'Monokai', value: 'monokai' },
  { title: 'Nord', value: 'nord' },
  { title: 'Peony', value: 'peony' },
  { title: 'Solarized', value: 'solarized' },
] as const satisfies BuiltInThemeOption[];

const remoteThemeNameSet = new Set<string>(themePreferenceNames);
const darkThemeNameSet = new Set<string>(darkThemeNames);

export function isRemoteThemePreference(
  theme: string
): theme is (typeof themePreferenceNames)[number] {
  return remoteThemeNameSet.has(theme);
}

export function getCustomThemeName(id: string): CustomThemeName {
  return `custom_${id.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`;
}

export function isCustomThemeName(theme: string): theme is CustomThemeName {
  return theme.startsWith('custom_');
}

export function normalizeThemePreference(
  theme: string | null,
  customThemeNames: string[] = []
): ThemePreference {
  if (!theme) {
    return 'auto';
  }

  const normalizedTheme = theme.toLowerCase();
  if (
    customThemeNames.includes(normalizedTheme) &&
    isCustomThemeName(normalizedTheme)
  ) {
    return normalizedTheme;
  }

  if (isCustomThemeName(normalizedTheme) && customThemeNames.length === 1) {
    return customThemeNames[0] as CustomThemeName;
  }

  return isRemoteThemePreference(normalizedTheme) ? normalizedTheme : 'auto';
}

export function getThemePreferenceMode(
  theme: ThemePreference,
  isSystemDark: boolean,
  customThemes: CustomThemeDefinition[] = []
): ThemeMode {
  if (theme === 'auto') {
    return isSystemDark ? 'dark' : 'light';
  }

  if (isCustomThemeName(theme)) {
    const customTheme =
      customThemes.find(
        (customTheme) => getCustomThemeRuntimeName(customTheme) === theme
      ) ?? customThemes[0];
    return customTheme?.mode ?? (isSystemDark ? 'dark' : 'light');
  }

  return darkThemeNameSet.has(theme) ? 'dark' : 'light';
}

export type TlonThemeTokens = {
  primaryText: string;
  color: string;
  secondaryText: string;
  background: string;
  transparentBackground: string;
  secondaryBackground: string;
  shadow: string;
  tertiaryText: string;
  border: string;
  secondaryBorder: string;
  activeBorder: string;
  positiveActionText: string;
  positiveBackground: string;
  positiveBorder: string;
  negativeActionText: string;
  negativeBackground: string;
  negativeBorder: string;
  darkBackground: string;
  overlayBackground: string;
  overlayBlurTint: 'light' | 'dark';
  neutralUnreadDot: string;
  systemNoticeBackground: string;
  systemNoticeBorder: string;
  systemNoticeText: string;
  mediaScrim: string;
};

export type CustomThemeDefinition = {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  params: {
    hue: number;
    width: number;
    saturation: number;
    brightness: number;
    harmony: ThemeHarmony;
  };
  theme: TlonThemeTokens;
  createdAt: number;
  updatedAt: number;
};

export type ThemeMode = 'light' | 'dark';
export type ThemeHarmony =
  | 'monochromatic'
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triadic';

export type CustomThemeParams = {
  name: string;
  hue: number;
  mode: ThemeMode;
  id?: string;
  createdAt?: number;
  width?: number;
  saturation?: number;
  brightness?: number;
  harmony?: ThemeHarmony;
};

export const customThemeSlotId = 'custom';

const accentOffsets = {
  base08: 0,
  base09: 32,
  base0A: 58,
  base0B: 126,
  base0C: 178,
  base0D: 214,
  base0E: 274,
  base0F: 316,
} as const;

const harmonies: Record<ThemeHarmony, number[]> = {
  monochromatic: [0, 0, 0, 0, 0, 0, 0, 0],
  analogous: [-42, -28, -14, 0, 14, 28, 42, 56],
  complementary: [0, 18, -18, 180, 156, 204, 36, -36],
  'split-complementary': [0, 24, -24, 150, 210, 168, 192, -42],
  triadic: [0, 24, -24, 120, 240, 144, 216, -48],
};

const accentKeys = [
  'base08',
  'base09',
  'base0A',
  'base0B',
  'base0C',
  'base0D',
  'base0E',
  'base0F',
] as const;

type Base16Key =
  | `base0${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`
  | (typeof accentKeys)[number];

type Base16Palette = Record<Base16Key, string>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapHue(value: number) {
  return ((value % 360) + 360) % 360;
}

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb = [0, 0, 0];

  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return rgb.map((channel) => Math.round((channel + m) * 255));
}

function rgbToHex(rgb: number[]) {
  return `#${rgb
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function linearToSrgb(channel: number) {
  const value =
    channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return Math.round(clamp(value, 0, 1) * 255);
}

function oklchToHex(lightness: number, chroma: number, hue: number) {
  const radians = (wrapHue(hue) * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return rgbToHex([linearToSrgb(r), linearToSrgb(g), linearToSrgb(blue)]);
}

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string) {
  return hexToRgb(hex)
    .map((channel) => {
      const value = channel / 255;
      return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    })
    .reduce(
      (sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index],
      0
    );
}

function contrastRatio(a: string, b: string) {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureContrast(hex: string, background: string, minimum: number) {
  let [r, g, b] = hexToRgb(hex);
  const bgIsDark = relativeLuminance(background) < 0.5;

  for (
    let i = 0;
    i < 48 && contrastRatio(rgbToHex([r, g, b]), background) < minimum;
    i += 1
  ) {
    const direction = bgIsDark ? 1 : -1;
    r = clamp(Math.round(r + direction * 5), 0, 255);
    g = clamp(Math.round(g + direction * 5), 0, 255);
    b = clamp(Math.round(b + direction * 5), 0, 255);
  }

  return rgbToHex([r, g, b]);
}

function rgbaFromHex(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(a: string, b: string, amount: number) {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  return rgbToHex(
    ar.map((channel, index) =>
      Math.round(channel * amount + br[index] * (1 - amount))
    )
  );
}

function readableTextOn(background: string) {
  return contrastRatio('#000000', background) >
    contrastRatio('#ffffff', background)
    ? '#000000'
    : '#FFFFFF';
}

function colorFromHsv(h: number, s: number, v: number) {
  return rgbToHex(hsvToRgb(wrapHue(h), clamp(s, 0, 1), clamp(v, 0, 1)));
}

function generatePalette({
  hue,
  width,
  saturation,
  brightness,
  mode,
  harmony,
}: Required<Omit<CustomThemeParams, 'name'>>): Base16Palette {
  const isDark = mode === 'dark';
  const sat = saturation / 100;
  const val = brightness / 100;
  const neutralHue = wrapHue(hue + (isDark ? -8 : 8));
  const neutralChroma = clamp(sat * 0.045, 0.012, 0.052);
  const darkRamp = [0.14, 0.19, 0.27, 0.43, 0.62, 0.79, 0.88, 0.96];
  const lightRamp = [0.97, 0.92, 0.84, 0.62, 0.45, 0.27, 0.18, 0.11];
  const palette = {} as Base16Palette;

  (isDark ? darkRamp : lightRamp).forEach((rampValue, index) => {
    const key = `base0${index}` as Base16Key;
    const distance = Math.abs(index - 3.5) / 3.5;
    const adjustedChroma = neutralChroma * (1 + distance * 0.28);
    palette[key] = oklchToHex(rampValue, adjustedChroma, neutralHue);
  });

  const harmonyAngles = harmonies[harmony] ?? harmonies.analogous;
  accentKeys.forEach((key, index) => {
    const fallbackOffset = accentOffsets[key] - 180;
    const harmonyOffset = harmonyAngles[index] ?? fallbackOffset;
    const accentHue = wrapHue(hue + harmonyOffset * (width / 100));
    const accentSat = clamp(sat + 0.12, 0.42, 0.94);
    const accentValue = isDark
      ? clamp(val + 0.08, 0.58, 0.96)
      : clamp(val - 0.08, 0.38, 0.78);

    palette[key] = colorFromHsv(accentHue, accentSat, accentValue);
  });

  palette.base05 = ensureContrast(
    palette.base05,
    palette.base00,
    isDark ? 7 : 9
  );
  palette.base03 = ensureContrast(palette.base03, palette.base00, 2.25);

  return palette;
}

function generateTlonTheme(
  palette: Base16Palette,
  opts: { hue: number; mode: ThemeMode }
): TlonThemeTokens {
  const isDark = opts.mode === 'dark';
  const background = palette.base00;
  const primaryText = palette.base05;
  const secondaryText = ensureContrast(palette.base04, background, 4.5);
  const tertiaryText = ensureContrast(palette.base03, background, 3);
  const positiveActionText = ensureContrast(palette.base0D, background, 4.5);
  const negativeActionText = ensureContrast(palette.base08, background, 4.5);
  const noticeAccent = palette.base0C;
  const systemNoticeBackground = ensureContrast(
    mixHex(noticeAccent, background, isDark ? 0.55 : 0.72),
    background,
    1.45
  );

  return {
    primaryText,
    color: primaryText,
    secondaryText,
    background,
    transparentBackground: rgbaFromHex(background, 0),
    secondaryBackground: palette.base01,
    shadow: rgbaFromHex(isDark ? '#ffffff' : '#181818', 0.08),
    tertiaryText,
    border: palette.base02,
    secondaryBorder: palette.base03,
    activeBorder: palette.base04,
    positiveActionText,
    positiveBackground: mixHex(
      positiveActionText,
      background,
      isDark ? 0.24 : 0.1
    ),
    positiveBorder: mixHex(
      positiveActionText,
      background,
      isDark ? 0.48 : 0.28
    ),
    negativeActionText,
    negativeBackground: mixHex(
      negativeActionText,
      background,
      isDark ? 0.22 : 0.09
    ),
    negativeBorder: mixHex(
      negativeActionText,
      background,
      isDark ? 0.46 : 0.26
    ),
    darkBackground: isDark ? oklchToHex(0.09, 0.02, opts.hue) : palette.base06,
    overlayBackground: isDark ? '#FFFFFF' : '#000000',
    overlayBlurTint: isDark ? 'light' : 'dark',
    neutralUnreadDot: palette.base04,
    systemNoticeBackground,
    systemNoticeBorder: mixHex(noticeAccent, background, isDark ? 0.78 : 0.36),
    systemNoticeText: ensureContrast(
      readableTextOn(systemNoticeBackground),
      systemNoticeBackground,
      4.5
    ),
    mediaScrim: 'rgba(0, 0, 0, 0.5)',
  };
}

export function createCustomThemeDefinition(
  params: CustomThemeParams
): CustomThemeDefinition {
  const now = Date.now();
  const id = params.id ?? customThemeSlotId;
  const normalized = {
    name: params.name.trim() || 'Custom Theme',
    hue: clamp(Math.round(params.hue), 0, 359),
    mode: params.mode,
    id,
    createdAt: params.createdAt ?? now,
    width: params.width ?? 72,
    saturation: params.saturation ?? 66,
    brightness: params.brightness ?? 82,
    harmony: params.harmony ?? 'analogous',
  } satisfies Required<CustomThemeParams>;
  const palette = generatePalette(normalized);

  return {
    id,
    name: normalized.name,
    mode: normalized.mode,
    params: {
      hue: normalized.hue,
      width: normalized.width,
      saturation: normalized.saturation,
      brightness: normalized.brightness,
      harmony: normalized.harmony,
    },
    theme: generateTlonTheme(palette, normalized),
    createdAt: normalized.createdAt,
    updatedAt: now,
  };
}

export function getCustomThemeRuntimeName(theme: CustomThemeDefinition) {
  return getCustomThemeName(`${theme.id}_${theme.updatedAt}`);
}
