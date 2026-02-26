import {
  enableE2E,
  isE2EActive,
  isE2EPending,
  isSignalUnlocked,
} from '@tloncorp/shared/store';
import { useCallback, useMemo, useState } from 'react';

import { useChannelContext } from '../contexts/channel';
import { ScreenHeader } from './ScreenHeader';
import { useRegisterChannelHeaderItem } from './Channel/ChannelHeader';
import { SignalAuthSheet } from './SignalAuthSheet';
import { E2EInfoSheet } from './E2EInfoSheet';

export function E2EHeaderButton() {
  const channel = useChannelContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  // Force re-render after state-changing operations (signalStore is not reactive)
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  const tryEnableE2E = useCallback(async () => {
    await enableE2E(channel.id);
    forceUpdate();
  }, [channel.id, forceUpdate]);

  const handlePress = useCallback(() => {
    if (!isSignalUnlocked()) {
      setAuthOpen(true);
      return;
    }

    if (isE2EActive(channel.id) || isE2EPending(channel.id)) {
      setInfoOpen(true);
      return;
    }

    // Unlocked but E2E not active — initiate
    tryEnableE2E();
  }, [channel.id, tryEnableE2E]);

  const handleUnlocked = useCallback(() => {
    forceUpdate();
    tryEnableE2E();
  }, [forceUpdate, tryEnableE2E]);

  const handleInfoDisable = useCallback(() => {
    forceUpdate();
  }, [forceUpdate]);

  useRegisterChannelHeaderItem(
    useMemo(
      () => (
        <ScreenHeader.IconButton
          key="e2e-lock"
          type="Lock"
          onPress={handlePress}
        />
      ),
      [handlePress]
    )
  );

  return (
    <>
      <SignalAuthSheet
        open={authOpen}
        onOpenChange={setAuthOpen}
        onUnlocked={handleUnlocked}
      />
      <E2EInfoSheet
        open={infoOpen}
        onOpenChange={setInfoOpen}
        channelId={channel.id}
        onDisable={handleInfoDisable}
      />
    </>
  );
}
