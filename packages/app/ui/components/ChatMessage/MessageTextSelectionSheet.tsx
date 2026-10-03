import { createDevLogger } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import { Text, useCopy, useToast } from '@tloncorp/ui';
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

import { useSheetDismissalAction } from '../../hooks/useSheetDismissalAction';
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
  const { dismissThenRun, onDismissed, cancel, presentationKey } =
    useSheetDismissalAction({
      open,
      onOpenChange: setOpen,
      // The sheet forces `mode="sheet"`, so it is native on wide windows too.
      waitForDismissal: Platform.OS !== 'web',
    });
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
      if (nextOpen) setOpen(true);
      else dismissThenRun(() => setSelection(null));
    },
    [dismissThenRun]
  );

  return (
    <MessageTextSelectionContext.Provider value={show}>
      {children}
      {selection && (
        <MessageTextSelectionSheet
          key={`${selection.post.id}:${presentationKey}`}
          {...selection}
          open={open}
          onOpenChange={onOpenChange}
          onNativeDismissed={onDismissed}
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
  onNativeDismissed,
}: {
  post: db.Post;
  text: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNativeDismissed?: () => void;
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
      onNativeDismissed={onNativeDismissed}
      onDidOpen={selectAllOnOpen}
      title="Select text"
      mode="sheet"
      snapPointsMode="percent"
      snapPoints={[65, 90]}
      enableContentPanningGesture={false}
      modal
    >
      <ActionSheet.SimpleHeader title="Select text" />
      <ActionSheet.ScrollableContent>
        <ActionSheet.ContentBlock paddingTop={0}>
          <XStack gap="$l" alignItems="flex-start">
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
        </ActionSheet.ContentBlock>
        <ActionSheet.ActionGroup accent="neutral">
          <ActionSheet.Action
            action={{
              title: 'Copy all text',
              startIcon: 'Copy',
              action: copyAll,
            }}
            testID="CopyAllMessageText"
          />
        </ActionSheet.ActionGroup>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
