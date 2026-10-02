import { createDevLogger } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import { Icon, Pressable, Text, useCopy, useToast } from '@tloncorp/ui';
import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  Text as NativeText,
  TextInput,
  findNodeHandle,
} from 'react-native';
import { XStack, YStack, useTheme } from 'tamagui';

import { useSheetCloseAfterAnimation } from '../../hooks/useSheetCloseAfterAnimation';
import { ActionSheet } from '../ActionSheet';
import { ContactAvatar } from '../Avatar';
import { ContactName } from '../ContactNameV2';
import { SentTimeText } from '../SentTimeText';

const logger = createDevLogger('MessageTextSelection', false);

const MessageTextSelectionContext = createContext<
  ((post: db.Post, text: string) => void) | null
>(null);

export const useMessageTextSelection = () =>
  useContext(MessageTextSelectionContext);

// Keep the sheet outside message rows and their dismissing action menus.
export function MessageTextSelectionProvider({ children }: PropsWithChildren) {
  const [selection, setSelection] = useState<{
    post: db.Post;
    text: string;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const { closeAfterAnimation, cancel } = useSheetCloseAfterAnimation();
  const show = useCallback(
    (post: db.Post, text: string) => {
      cancel();
      setSelection({ post, text });
      setOpen(true);
    },
    [cancel]
  );
  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        closeAfterAnimation(() => setSelection(null));
      }
    },
    [closeAfterAnimation]
  );

  return (
    <MessageTextSelectionContext.Provider value={show}>
      {children}
      {selection && (
        <MessageTextSelectionSheet
          key={selection.post.id}
          {...selection}
          open={open}
          onOpenChange={onOpenChange}
        />
      )}
    </MessageTextSelectionContext.Provider>
  );
}

export function MessageTextSelectionSheet({
  post,
  text,
  open,
  onOpenChange,
}: {
  post: db.Post;
  text: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const textRef = useRef<NativeText>(null);
  const didSelectAll = useRef(false);

  useEffect(() => {
    if (!open) didSelectAll.current = false;
  }, [open]);

  const selectAllOnOpen = useCallback(() => {
    if (!open || didSelectAll.current) return;
    if (Platform.OS === 'ios') {
      if (!inputRef.current) return;
      inputRef.current.setSelection(0, text.length);
    } else if (Platform.OS === 'android') {
      const viewTag = findNodeHandle(textRef.current);
      if (viewTag === null) return;
      // Older Android builds can still select manually until rebuilt.
      const nativeSelection = requireOptionalNativeModule<{
        selectAll: (viewTag: number) => Promise<boolean>;
      }>('TlonTextSelection');
      void nativeSelection?.selectAll(viewTag).catch((error) => {
        logger.trackError('Unable to preselect message text', error);
      });
    }
    didSelectAll.current = true;
  }, [open, text]);
  const { doCopy } = useCopy(text);
  const showToast = useToast();
  const copyAll = useCallback(async () => {
    await doCopy();
    onOpenChange(false);
    showToast({ message: 'Copied text' });
  }, [doCopy, onOpenChange, showToast]);

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      onDidOpen={selectAllOnOpen}
      title="Select text"
      mode="sheet"
      snapPointsMode="percent"
      snapPoints={[65, 90]}
      enableContentPanningGesture={false}
      hasScrollableContent
      modal
    >
      <XStack
        alignItems="center"
        justifyContent="center"
        minHeight={48}
        marginBottom="$l"
      >
        <Text size="$label/2xl" accessibilityRole="header">
          Select text
        </Text>
        <Pressable
          position="absolute"
          right="$m"
          width={44}
          height={44}
          alignItems="center"
          justifyContent="center"
          accessibilityRole="button"
          accessibilityLabel="Close text selection"
          onPress={() => onOpenChange(false)}
          testID="CloseTextSelection"
        >
          <Icon type="Close" size="$m" color="$secondaryText" />
        </Pressable>
      </XStack>
      <ActionSheet.ScrollableContent>
        <XStack
          gap="$l"
          paddingHorizontal="$xl"
          paddingBottom="$xl"
          alignItems="flex-start"
        >
          <ContactAvatar contactId={post.authorId} size="$3xl" />
          <YStack flex={1} gap="$s">
            <XStack gap="$m" alignItems="center" flexWrap="wrap">
              <Text size="$label/2xl" flexShrink={1}>
                <ContactName contactId={post.authorId} />
              </Text>
              <SentTimeText sentAt={post.sentAt} showFullDate />
            </XStack>
            {Platform.OS === 'ios' ? (
              // iOS Text's selectable prop only offers whole-message copying.
              // A read-only UITextView provides native range-selection handles.
              <TextInput
                key={open ? 'open' : 'closed'}
                ref={inputRef}
                autoFocus={open}
                value={text}
                multiline
                editable={false}
                showSoftInputOnFocus={false}
                scrollEnabled={false}
                style={{
                  color: theme.primaryText.val,
                  fontSize: 16,
                  lineHeight: 24,
                  padding: 0,
                }}
                testID="SelectableMessageText"
              />
            ) : (
              <NativeText
                ref={textRef}
                selectable
                style={{
                  color: theme.primaryText.val,
                  fontSize: 16,
                  lineHeight: 24,
                }}
                testID="SelectableMessageText"
              >
                {text}
              </NativeText>
            )}
          </YStack>
        </XStack>
        <Pressable
          onPress={copyAll}
          accessibilityRole="button"
          accessibilityLabel="Copy all text"
          testID="CopyAllMessageText"
          borderTopWidth={1}
          borderColor="$secondaryBorder"
          paddingHorizontal="$xl"
          paddingVertical="$xl"
          flexDirection="row"
          alignItems="center"
          gap="$l"
        >
          <Icon type="Copy" size="$m" />
          <Text size="$label/l">Copy all text</Text>
        </Pressable>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
