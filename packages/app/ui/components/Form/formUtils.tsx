import { ColorTokens } from 'tamagui';

export type Accent = 'positive' | 'negative' | 'neutral';
export type BackgroundType = 'primary' | 'secondary';

export function getBorderVariantStyle<TProps extends Record<string, unknown>>(
  backgroundType: BackgroundType,
  { props }: { props: TProps }
) {
  return {
    borderColor: getBorderColor(backgroundType, props),
    borderWidth: 1,
  };
}

export function getBorderColor<TProps extends Record<string, unknown>>(
  backgroundType: BackgroundType,
  props: TProps
): ColorTokens {
  const accent = props.accent ? (props.accent as Accent) : 'neutral';
  switch (accent) {
    case 'positive':
      return '$positiveBorder';
    case 'negative':
      return '$negativeBorder';
    case 'neutral':
      return backgroundType === 'primary' ? '$border' : '$secondaryBorder';
  }
}
