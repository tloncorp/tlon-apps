import { ForwardingProps } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  LayoutRectangle,
  View,
} from 'react-native';
import { styled, useTheme } from 'tamagui';

export const DUMMY_WAVEFORM_VALUES = [
  1, 0.5, 1, 0.2, 0.8, 0.4, 0.6, 0.3, 0.7, 0.1, 0.9, 0.5, 1, 0.4, 0.6,
];

export function Waveform({
  values,
  visualRange,
  candleWidth = 6,
  candleSpacing = 2,
  style,
  onLayout: onLayoutProp,
  ...passedProps
}: ForwardingProps<
  typeof View,
  {
    values: number[];
    visualRange?: [min: number, max: number];
    candleWidth?: number;
    candleSpacing?: number;
  },
  'ref'
>) {
  const [layout, setLayout] = useState<LayoutRectangle | null>(null);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setLayout(event.nativeEvent.layout);
      onLayoutProp?.(event);
    },
    [onLayoutProp]
  );

  const maxVisibleCandleCount = useMemo(
    () =>
      layout ? Math.floor(layout.width / (candleWidth + candleSpacing)) : null,
    [layout, candleWidth, candleSpacing]
  );

  const valuesWithPadding = useMemo(() => {
    const out: (number | null)[] = [...values];
    if (
      maxVisibleCandleCount != null &&
      values.length < maxVisibleCandleCount
    ) {
      const paddingCount = maxVisibleCandleCount - values.length;
      const padding: null[] = Array(paddingCount).fill(null);
      out.push(...padding);
    }
    return out;
  }, [values, maxVisibleCandleCount]);

  const effectiveVisualRange = useMemo(() => {
    if (visualRange) {
      return visualRange;
    }
    const min = 0; // assume values are amplitudes
    const max = Math.max(...values);
    return [min, max];
  }, [visualRange, values]);

  return (
    <FlatList
      {...passedProps}
      contentContainerStyle={{ alignItems: 'center' }}
      onLayout={onLayout}
      style={[{ flexGrow: 0, opacity: layout == null ? 0 : 1 }, style]}
      data={valuesWithPadding}
      alwaysBounceHorizontal={false}
      horizontal
      initialNumToRender={maxVisibleCandleCount ?? undefined}
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => {
        const [min, max] = effectiveVisualRange;
        const range = max - min;
        const heightRatio =
          item == null ? null : range === 0 ? 1 : (item - min) / range;
        return (
          <Candle
            active={heightRatio != null}
            style={[
              {
                width: candleWidth,
                marginRight: candleSpacing,
              },
              heightRatio != null && {
                height: layout
                  ? layout.height * heightRatio
                  : `${heightRatio * 100}%`,
              },
            ]}
          />
        );
      }}
      keyExtractor={(_, index) => index.toString()}
    />
  );
}

const Candle = styled(View, {
  borderRadius: 40,
  minHeight: 5,

  variants: {
    active: {
      true: {
        backgroundColor: '$primaryText',
      },
      false: {
        backgroundColor: '$border',
      },
    },
  },
});
