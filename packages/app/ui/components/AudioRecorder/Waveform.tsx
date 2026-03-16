import * as sk from '@shopify/react-native-skia';
import { ForwardingProps } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, LayoutRectangle, View } from 'react-native';
import { useTheme } from 'tamagui';

export function Waveform({
  values,
  visualRange,
  candleWidth = 6,
  candleSpacing = 2,
  candleActiveColor: candleActiveColorProp,
  candleUnplayedColor: candleUnplayedColorProp,
  candleInactiveColor: candleInactiveColorProp,
  candlePlaybackPosition = 0,
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
    candleActiveColor?: string;
    /** color for candles whose index >= candlePlaybackPosition, i.e. the "unplayed" portion of the waveform */
    candleUnplayedColor?: string;
    /** used to fill out container for short sounds */
    candleInactiveColor?: string;
    candlePlaybackPosition?: number;
  },
  'ref'
>) {
  const theme = useTheme();
  const candleActiveColor = candleActiveColorProp ?? theme.primaryText.get();
  const candleUnplayedColor =
    candleUnplayedColorProp ?? theme.tertiaryText.get();
  const candleInactiveColor =
    candleInactiveColorProp ?? theme.tertiaryText.get();

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

  // if candles don't fill width, pad with nulls.
  // if candles exceed width, simplify waveform to fit
  const valuesWithPadding = useMemo(() => {
    let out: (number | null)[] = [...values];
    if (maxVisibleCandleCount != null) {
      if (values.length < maxVisibleCandleCount) {
        const paddingCount = maxVisibleCandleCount - values.length;
        const padding: null[] = Array(paddingCount).fill(null);
        out.push(...padding);
      }
      if (values.length > maxVisibleCandleCount) {
        out = simplifyWaveform(values, maxVisibleCandleCount);
      }
    }
    return out;
  }, [values, maxVisibleCandleCount]);

  const scaledCandlePlaybackPosition = useMemo(() => {
    if (
      maxVisibleCandleCount == null ||
      values.length <= maxVisibleCandleCount
    ) {
      return candlePlaybackPosition;
    }
    return Math.floor(
      (candlePlaybackPosition / values.length) * maxVisibleCandleCount
    );
  }, [candlePlaybackPosition, values.length, maxVisibleCandleCount]);

  const effectiveVisualRange = useMemo(() => {
    if (visualRange) {
      return visualRange;
    }
    const min = 0; // assume values are amplitudes
    const max = Math.max(...values);
    return [min, max];
  }, [visualRange, values]);

  return (
    <sk.Canvas {...passedProps} style={style} onLayout={onLayout}>
      {layout &&
        valuesWithPadding.map((value, index) => {
          const [min, max] = effectiveVisualRange;
          const range = max - min;
          const heightRatio =
            value == null ? null : range === 0 ? 1 : (value - min) / range;
          const height = Math.max(5, layout.height * (heightRatio ?? 0));
          return (
            <sk.RoundedRect
              key={index}
              x={index * (candleWidth + candleSpacing)}
              y={(layout.height - height) * 0.5}
              width={candleWidth}
              height={Math.max(5, layout.height * (heightRatio ?? 0))}
              r={40}
              color={
                heightRatio == null
                  ? candleInactiveColor
                  : index < scaledCandlePlaybackPosition
                    ? candleActiveColor
                    : candleUnplayedColor
              }
            />
          );
        })}
    </sk.Canvas>
  );
}

function simplifyWaveform(values: number[], targetCount: number): number[] {
  if (values.length <= targetCount) {
    return values;
  }

  const bucketSize = values.length / targetCount;
  const simplified: number[] = [];
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    const bucketValues = values.slice(start, end);
    const bucketAverage =
      bucketValues.reduce((sum, val) => sum + val, 0) / bucketValues.length;
    simplified.push(bucketAverage);
  }
  return simplified;
}
