import * as api from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Icon, Pressable } from '@tloncorp/ui';
import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import { XStack } from 'tamagui';

import { useTelemetry } from '../../../hooks/useTelemetry';
import { ContextLensButton } from '../Channel/ContextLens/ContextLensButton';
import { triggerHaptic } from '../../utils';
import { BotFeedbackSheet } from './BotFeedbackSheet';

export function BotFeedbackRow({
  post,
  currentUserId,
  onPressBotRun,
  visible = true,
}: {
  post: db.Post;
  currentUserId: string;
  onPressBotRun?: (post: db.Post) => void;
  visible?: boolean;
}) {
  const isWeb = Platform.OS === 'web';
  // Rating feedback only applies to the user's Tlon-hosted bot; other owned
  // bots mount this row solely for the Context Lens action.
  const canRate = api.isBotUserIdForUser(post.authorId, currentUserId);
  const telemetry = useTelemetry();
  const messageId = store.getBotReplyMessageId(post);
  const { data: feedback } = store.useBotReplyFeedback(messageId);
  const [sheetRating, setSheetRating] =
    useState<api.BotReplyFeedbackRating>('up');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const pendingVote = useRef<Promise<unknown> | null>(null);

  const handleRating = async (rating: api.BotReplyFeedbackRating) => {
    if (changing) return;
    triggerHaptic('baseButtonClick');
    const clearing = feedback?.rating === rating;
    if (!clearing) {
      setSheetRating(rating);
      setSheetOpen(true);
    }

    setChanging(true);
    try {
      const change = store.changeBotReplyFeedback({
        post,
        action: clearing ? 'clear' : 'set',
        rating: clearing ? undefined : rating,
        captureMandatoryEvent: telemetry.captureMandatoryEvent,
      });
      pendingVote.current = change;
      await change;
    } catch (error) {
      if (!clearing) setSheetOpen(false);
      console.error('Failed to save bot reply feedback', error);
    } finally {
      pendingVote.current = null;
      setChanging(false);
    }
  };

  const handleDetails = async (categories: string[], details: string) => {
    await pendingVote.current;
    await store.submitBotReplyFeedbackDetails({
      post,
      rating: sheetRating,
      categories,
      details,
      currentUserId,
      captureMandatoryEvent: telemetry.captureMandatoryEvent,
    });
  };

  const handleSheetRatingChange = async (
    rating: api.BotReplyFeedbackRating
  ) => {
    if (rating === sheetRating || changing) return;
    const previousRating = sheetRating;
    setSheetRating(rating);
    setChanging(true);
    try {
      const change = store.changeBotReplyFeedback({
        post,
        action: 'set',
        rating,
        captureMandatoryEvent: telemetry.captureMandatoryEvent,
      });
      pendingVote.current = change;
      await change;
    } catch (error) {
      setSheetRating(previousRating);
      console.error('Failed to update bot reply feedback', error);
      throw error;
    } finally {
      pendingVote.current = null;
      setChanging(false);
    }
  };

  return (
    <>
      <XStack
        gap={isWeb ? '$2xs' : '$s'}
        alignItems="center"
        height={isWeb ? 20 : undefined}
        paddingBottom={isWeb ? undefined : '$m'}
      >
        {visible && <ContextLensButton post={post} onPress={onPressBotRun} />}
        {visible &&
          canRate &&
          (['up', 'down'] as const).map((rating) => {
            const selected = feedback?.rating === rating;
            return (
              <Pressable
                key={rating}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleRating(rating);
                }}
                disabled={changing}
                cursor="pointer"
                accessibilityLabel={
                  rating === 'up'
                    ? 'Rate bot reply positively'
                    : 'Rate bot reply negatively'
                }
                accessibilityRole="button"
                width={isWeb ? 20 : 24}
                height={isWeb ? 20 : 24}
                hitSlop={6}
                alignItems="center"
                justifyContent="center"
                borderRadius="$xs"
                backgroundColor={selected ? '$positiveBackground' : 'unset'}
                pressStyle={{
                  backgroundColor: selected
                    ? '$positiveBorder'
                    : '$activeBorder',
                }}
                hoverStyle={{
                  backgroundColor: selected
                    ? '$positiveBorder'
                    : '$activeBorder',
                }}
                testID={rating === 'up' ? 'BotFeedbackUp' : 'BotFeedbackDown'}
              >
                <Icon
                  type={rating === 'up' ? 'ThumbsUp' : 'ThumbsDown'}
                  customSize={isWeb ? [14, 14] : [18, 18]}
                  color={selected ? '$positiveActionText' : '$tertiaryText'}
                />
              </Pressable>
            );
          })}
      </XStack>
      <BotFeedbackSheet
        open={sheetOpen}
        rating={sheetRating}
        onOpenChange={setSheetOpen}
        onRatingChange={handleSheetRatingChange}
        onSubmit={handleDetails}
      />
    </>
  );
}
