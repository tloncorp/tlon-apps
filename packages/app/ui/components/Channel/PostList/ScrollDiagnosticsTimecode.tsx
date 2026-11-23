import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import { scrollDiagRecorder } from './scrollDiagnostics';
import { syncUiClock } from './scrollDiagnosticsFrames';

/**
 * A strip of black and white cells along the left edge that spells out the
 * diagnostics clock in binary, redrawn on the UI thread every frame. A screen
 * recording then carries, in each frame, the time of the timeline entries
 * that produced it, so a glitch seen in the video can be looked up exactly.
 *
 * Top to bottom: a red cell, the clock in units of `TIMECODE_UNIT_MS` as
 * `TIMECODE_BITS` bits (most significant first, white is 1), a blue cell.
 */
export const TIMECODE_BITS = 14;
export const TIMECODE_UNIT_MS = 10;
export const TIMECODE_CELL = 6;

function TimecodeBit({
  bit,
  code,
}: {
  bit: number;
  code: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: (code.get() >> bit) & 1 ? '#ffffff' : '#000000',
  }));
  return <Animated.View style={[styles.cell, style]} />;
}

export function ScrollDiagnosticsTimecode() {
  // Adding this to the UI thread's clock gives the diagnostics clock.
  const uiToRecorder = useSharedValue<number | null>(null);
  const code = useSharedValue(0);

  React.useEffect(
    () =>
      syncUiClock(
        () => scrollDiagRecorder.time(),
        (offset) => uiToRecorder.set(offset)
      ),
    [uiToRecorder]
  );

  useFrameCallback(() => {
    const offset = uiToRecorder.get();
    if (offset === null) {
      return;
    }
    code.set(
      Math.floor((performance.now() + offset) / TIMECODE_UNIT_MS) %
        (1 << TIMECODE_BITS)
    );
  });

  return (
    <View pointerEvents="none" style={styles.strip}>
      <View style={[styles.cell, styles.start]} />
      {Array.from({ length: TIMECODE_BITS }, (_, index) => (
        <TimecodeBit key={index} bit={TIMECODE_BITS - 1 - index} code={code} />
      ))}
      <View style={[styles.cell, styles.end]} />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    left: 0,
    position: 'absolute',
    top: '40%',
    zIndex: 2000,
  },
  cell: {
    height: TIMECODE_CELL,
    width: TIMECODE_CELL,
  },
  start: { backgroundColor: '#ff0000' },
  end: { backgroundColor: '#0000ff' },
});
