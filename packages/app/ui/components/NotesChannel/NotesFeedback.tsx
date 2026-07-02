import { Pressable, Text } from '@tloncorp/ui';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { ScrollView, XStack, YStack } from 'tamagui';

const NOTES_PENDING_WRITE_MESSAGE = '%notes write request is still pending';

export function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function formatNotesBannerMessage(message: string) {
  const trimmedMessage = message.trim();
  if (trimmedMessage.includes(NOTES_PENDING_WRITE_MESSAGE)) {
    return {
      message:
        'Your change may still be syncing. Check the note before trying again.',
      details: trimmedMessage,
    };
  }

  return { message: trimmedMessage };
}

export function confirmNotesDestructiveAction({
  action,
  nativeMessage,
  nativeTitle,
  webMessage,
}: {
  action: () => void;
  nativeMessage: string;
  nativeTitle: string;
  webMessage: string;
}) {
  if (Platform.OS === 'web') {
    const confirm = (globalThis as { confirm?: (message: string) => boolean })
      .confirm;
    if (typeof confirm === 'function' && !confirm(webMessage)) return;
    action();
    return;
  }

  Alert.alert(nativeTitle, nativeMessage, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: action },
  ]);
}

export function NotesBanner({
  message,
  tone = 'neutral',
}: {
  message: string;
  tone?: 'neutral' | 'negative';
}) {
  const isNegative = tone === 'negative';
  const [showDetails, setShowDetails] = useState(false);
  const displayMessage = useMemo(
    () => formatNotesBannerMessage(message),
    [message]
  );

  useEffect(() => {
    setShowDetails(false);
  }, [message]);

  return (
    <YStack
      backgroundColor={
        isNegative ? '$negativeBackground' : '$secondaryBackground'
      }
      borderBottomColor={isNegative ? '$negativeBorder' : '$border'}
      borderBottomWidth={1}
    >
      <XStack
        alignItems="flex-start"
        gap="$m"
        paddingHorizontal="$l"
        paddingVertical="$s"
      >
        <Text
          flex={1}
          minWidth={0}
          size="$label/s"
          color={isNegative ? '$negativeActionText' : '$secondaryText'}
        >
          {displayMessage.message}
        </Text>
        {displayMessage.details ? (
          <Pressable onPress={() => setShowDetails((showing) => !showing)}>
            <Text
              size="$label/s"
              fontWeight="600"
              color={isNegative ? '$negativeActionText' : '$secondaryText'}
            >
              {showDetails ? 'Hide' : 'Details'}
            </Text>
          </Pressable>
        ) : null}
      </XStack>
      {showDetails && displayMessage.details ? (
        <ScrollView maxHeight={160} paddingHorizontal="$l" paddingBottom="$s">
          <Text
            size="$label/s"
            fontFamily="$mono"
            color={isNegative ? '$negativeActionText' : '$secondaryText'}
          >
            {displayMessage.details}
          </Text>
        </ScrollView>
      ) : null}
    </YStack>
  );
}
