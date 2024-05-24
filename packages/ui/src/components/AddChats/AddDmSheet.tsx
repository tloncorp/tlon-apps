import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { XStack, YStack, ZStack } from '../../core';
import { Button } from '../Button';
import { ContactBook } from '../ContactBook';
import { LoadingSpinner } from '../LoadingSpinner';
import { Sheet } from '../Sheet';

export function StartDmSheet({
  open,
  onOpenChange,
  goToDm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goToDm: (participants: string[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [contentScrolling, setContentScrolling] = useState(false);
  const [dmParticipants, setDmParticipants] = useState<string[]>([]);
  const [contactBookKey, setContactBookKey] = useState<number>(0);

  const handleDismiss = useCallback(() => {
    setDmParticipants([]);
    onOpenChange(false);
    // let close animate, then reset the contact book participants
    setTimeout(() => setContactBookKey((key) => key + 1), 300);
  }, [onOpenChange]);

  const handleGoToDm = useCallback(() => {
    goToDm(dmParticipants);
    setTimeout(() => setContactBookKey((key) => key + 1), 300);
  }, [dmParticipants, goToDm]);

  return (
    <Sheet
      open={open}
      onOpenChange={handleDismiss}
      snapPoints={[85]}
      modal
      disableDrag={contentScrolling}
      dismissOnSnapToBottom
      animation="quick"
    >
      <Sheet.Overlay />
      <Sheet.Frame paddingTop="$s" paddingHorizontal="$2xl">
        <Sheet.Handle marginBottom="$l" />
        <ZStack flex={1}>
          <YStack flex={1} gap="$2xl">
            <ContactBook
              key={contactBookKey}
              multiSelect
              onSelectedChange={setDmParticipants}
              searchable
              searchPlaceholder="Start a DM with..."
              onScrollChange={setContentScrolling}
            />
            {dmParticipants.length > 0 && (
              <XStack
                position="absolute"
                bottom={insets.bottom + 12}
                justifyContent="center"
              >
                <StartDMButton
                  participants={dmParticipants}
                  onPress={handleGoToDm}
                />
              </XStack>
            )}
          </YStack>
        </ZStack>
      </Sheet.Frame>
    </Sheet>
  );
}

function StartDMButton({
  participants,
  onPress,
}: {
  participants: string[];
  onPress: () => void;
}) {
  const isMultiDm = participants.length > 1;

  store.useForceNegotiationUpdate(participants, 'chat');
  const {
    match: negotiationMatch,
    isLoading: negotiationLoading,
    haveAllNegotiations,
  } = store.useNegotiateMulti(participants, 'chat', 'chat');
  const multiDmVersionMismatch = !negotiationLoading && !negotiationMatch;
  const shouldBlockInput = isMultiDm && multiDmVersionMismatch;

  return (
    <Button
      hero
      onPress={onPress}
      disabled={participants.length === 0 || shouldBlockInput}
    >
      {shouldBlockInput ? (
        <>
          <Button.Text>
            {haveAllNegotiations
              ? 'Not all Urbits on the same version'
              : 'Checking version compatibility'}
          </Button.Text>
          {!haveAllNegotiations && (
            <Button.Icon>
              <LoadingSpinner />
            </Button.Icon>
          )}
        </>
      ) : (
        <Button.Text>
          Start DM with {participants.length}{' '}
          {participants.length === 1 ? 'person' : 'people'}
        </Button.Text>
      )}
    </Button>
  );
}
