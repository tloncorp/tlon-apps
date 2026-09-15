import { MotiView } from 'moti';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

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
  onViewBotRun,
  onShowEmojiPicker,
}: ChatMessageActionsProps) {
  const insets = useSafeAreaInsets();
  const PADDING_THRESHOLD = 40;

  useEffect(() => {
    // on mount, give initial haptic feeedback
    triggerHaptic('sheetOpen');
  }, []);

  return (
    <MotiView
      style={{ flex: 1 }}
      pointerEvents="box-none"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 200 }}
    >
      <View
        flex={1}
        justifyContent="center"
        paddingTop={insets.top + PADDING_THRESHOLD}
        paddingBottom={insets.bottom + PADDING_THRESHOLD}
        paddingHorizontal="$xl"
        pointerEvents="box-none"
      >
        <ScrollView flexGrow={0} flexShrink={1}>
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
              onViewBotRun={onViewBotRun}
            />
          </YStack>
        </ScrollView>
      </View>
    </MotiView>
  );
}
