import { loadAuthType } from '@tloncorp/shared/api';
import {
  clearPendingInitiation,
  enableE2E,
  hasPendingInitiation,
  isE2EActive,
  isE2EPending,
  isSignalUnlocked,
} from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  const autoPrompted = useRef(false);

  const tryEnableE2E = useCallback(async () => {
    await enableE2E(channel.id);
    forceUpdate();
  }, [channel.id, forceUpdate]);

  const unlocked = isSignalUnlocked();
  const active = isE2EActive(channel.id);
  const pending = isE2EPending(channel.id);
  const hasPending = hasPendingInitiation(channel.id);

  // Auto-prompt: if the peer initiated E2E and we haven't unlocked yet,
  // open the auth sheet automatically so the user can unlock to accept.
  useEffect(() => {
    if (hasPending && !unlocked) {
      setAuthOpen(true);
    }
  }, [hasPending, unlocked]);

  // Auto-prompt on mount: if user has saved credentials but hasn't
  // unlocked yet, prompt them to unlock so E2E works automatically.
  useEffect(() => {
    if (unlocked || autoPrompted.current) return;
    autoPrompted.current = true;
    loadAuthType().then((authType) => {
      if (authType && !isSignalUnlocked()) {
        setAuthOpen(true);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Icon color:
  //   not authed  → secondary text (muted)
  //   authed, no E2E → caution/warning color
  //   E2E active  → positive/blue
  const iconColor = !unlocked
    ? '$tertiaryText'
    : active
      ? '$positiveActionText'
      : pending
        ? '$cautionText'
        : '$cautionText';

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
    clearPendingInitiation(channel.id);
    forceUpdate();
    tryEnableE2E();
  }, [channel.id, forceUpdate, tryEnableE2E]);

  const handleInfoDisable = useCallback(() => {
    forceUpdate();
  }, [forceUpdate]);

  useRegisterChannelHeaderItem(
    useMemo(
      () => (
        <ScreenHeader.IconButton
          key="e2e-lock"
          type="Lock"
          color={iconColor}
          onPress={handlePress}
        />
      ),
      [handlePress, iconColor]
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
