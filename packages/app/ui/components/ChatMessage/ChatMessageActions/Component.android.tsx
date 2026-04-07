import { ConfirmDialog } from '@tloncorp/ui';
import { MotiView } from 'moti';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import { triggerHaptic } from '../../../utils';
import { EmojiToolbar } from './EmojiToolbar';
import MessageActions from './MessageActions';
import { MessageContainer } from './MessageContainer';
import { ChatMessageActionsProps } from './types';

export function ChatMessageActions({
  post,
  postActionIds,
  onDismiss,
  onReply,
  onEdit,
  onViewReactions,
  onShowEmojiPicker,
}: ChatMessageActionsProps) {
  const [topOffset, setTopOffset] = useState(0);
  const insets = useSafeAreaInsets();
  const PADDING_THRESHOLD = 40;

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const confirmDeleteRef = useRef<(() => void) | null>(null);
  const deletePostTermRef = useRef('message');

  const handleRequestDeleteConfirmation = useCallback(
    (postTerm: string, onConfirm: () => void) => {
      deletePostTermRef.current = postTerm;
      confirmDeleteRef.current = onConfirm;
      setShowDeleteConfirmation(true);
    },
    []
  );

  const handleConfirmDelete = useCallback(() => {
    confirmDeleteRef.current?.();
    confirmDeleteRef.current = null;
    setShowDeleteConfirmation(false);
  }, []);

  function handleLayout(event: LayoutChangeEvent) {
    const { height } = event.nativeEvent.layout;
    const verticalPosition = calcVerticalPosition(height);
    setTopOffset(verticalPosition);
  }

  function calcVerticalPosition(height: number): number {
    const screenHeight = Dimensions.get('window').height;
    const safeTop = insets.top + PADDING_THRESHOLD;
    const safeBottom = screenHeight - insets.bottom - PADDING_THRESHOLD;
    const availableHeight = safeBottom - safeTop;

    const centeredPosition = (availableHeight - height) / 2 + safeTop;

    return Math.min(Math.max(centeredPosition, safeTop), safeBottom - height);
  }

  useEffect(() => {
    // on mount, give initial haptic feeedback
    triggerHaptic('sheetOpen');
  }, []);

  return (
    <>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 200 }}
      >
        <View
          position="absolute"
          top={topOffset}
          onLayout={handleLayout}
          paddingHorizontal="$xl"
        >
          <YStack gap="$xs">
            <EmojiToolbar
              post={post}
              onDismiss={onDismiss}
              openExternalSheet={onShowEmojiPicker}
            />
            <MessageContainer post={post} />
            <MessageActions
              post={post}
              postActionIds={postActionIds}
              dismiss={onDismiss}
              onReply={onReply}
              onEdit={onEdit}
              onViewReactions={onViewReactions}
              onRequestDeleteConfirmation={handleRequestDeleteConfirmation}
            />
          </YStack>
        </View>
      </MotiView>
      <ConfirmDialog
        open={showDeleteConfirmation}
        onOpenChange={setShowDeleteConfirmation}
        title={`Delete ${deletePostTermRef.current}?`}
        description="This action cannot be undone."
        confirmText={`Delete ${deletePostTermRef.current}`}
        destructive
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
