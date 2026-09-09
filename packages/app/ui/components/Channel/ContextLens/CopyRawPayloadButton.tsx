import { Icon, Pressable, useCopy } from '@tloncorp/ui';
import { useMemo } from 'react';
import { SizableText, XStack } from 'tamagui';

/**
 * Copies a run exactly as the client received it. The inspector renders a
 * narrowed view of a lens, so any field it doesn't surface is otherwise
 * invisible; the raw envelope is what makes a run diffable against what the bot
 * actually reported.
 *
 * Takes `unknown` because the two surfaces hold different envelopes — the run
 * screen has the stored `{schemaVersion, lens}` record, the panel has the live
 * gateway event. Renders nothing without a payload, so callers can place it
 * unconditionally.
 */
export function CopyRawPayloadButton({ payload }: { payload: unknown }) {
  const raw = useMemo(
    () => (payload == null ? null : JSON.stringify(payload, null, 2)),
    [payload]
  );
  const { doCopy, didCopy } = useCopy(raw ?? '');

  if (raw === null) {
    return null;
  }

  return (
    <Pressable
      onPress={doCopy}
      cursor="pointer"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$s"
      paddingHorizontal="$s"
      paddingVertical="$2xs"
      backgroundColor="$background"
      testID="LensCopyRawPayloadButton"
    >
      <XStack alignItems="center" gap="$2xs">
        <Icon
          type={didCopy ? 'Checkmark' : 'Copy'}
          color="$secondaryText"
          customSize={[12, 12]}
        />
        <SizableText size="$s" color="$secondaryText">
          {didCopy ? 'Copied' : 'Copy raw'}
        </SizableText>
      </XStack>
    </Pressable>
  );
}
