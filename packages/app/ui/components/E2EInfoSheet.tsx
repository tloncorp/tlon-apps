import { disableE2E, isE2EActive, isE2EPending } from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';
import { Text } from 'tamagui';

import { ActionSheet } from './ActionSheet';

export function E2EInfoSheet({
  open,
  onOpenChange,
  channelId,
  onDisable,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  onDisable?: () => void;
}) {
  const active = isE2EActive(channelId);
  const pending = isE2EPending(channelId);

  const statusText = active
    ? 'Messages are end-to-end encrypted.'
    : pending
      ? 'Waiting for peer to complete handshake...'
      : 'Encryption is not active.';

  const handleDisable = useCallback(() => {
    disableE2E(channelId);
    onDisable?.();
    onOpenChange(false);
  }, [channelId, onDisable, onOpenChange]);

  const actions = useMemo(
    () =>
      active || pending
        ? [{ title: 'Disable end-to-end encryption', action: handleDisable }]
        : [],
    [active, pending, handleDisable]
  );

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader title="Encryption status" />
      <ActionSheet.Content>
        <ActionSheet.ContentBlock>
          <Text size="$body" color="$primaryText">
            {statusText}
          </Text>
        </ActionSheet.ContentBlock>
        {actions.length > 0 && (
          <ActionSheet.ActionGroup accent="negative">
            {actions.map((action, index) => (
              <ActionSheet.Action key={index} action={action} />
            ))}
          </ActionSheet.ActionGroup>
        )}
      </ActionSheet.Content>
    </ActionSheet>
  );
}
