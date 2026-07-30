import { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import { GlassSurface } from '../GlassSurface.ios';

export const usesFloatingPinnedPostBanner = true;

export function PinnedPostBannerChrome({
  children,
}: PropsWithChildren<object>) {
  return (
    <GlassSurface glassEffectStyle="regular" style={styles.chrome}>
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  chrome: {
    borderRadius: 22,
    overflow: 'hidden',
  },
});
