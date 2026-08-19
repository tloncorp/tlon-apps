import type { BotReplyFeedbackRating } from '@tloncorp/api';
import { Button, Icon, Pressable, Text, useIsWindowNarrow } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { TextInput } from '../Form';

const CATEGORIES: Record<BotReplyFeedbackRating, string[]> = {
  down: [
    'Incorrect',
    "Didn't follow instructions",
    'Missed the context',
    'Too long',
    'Too slow to answer',
    'Unsafe or inappropriate',
    'Other',
  ],
  up: [
    'Accurate',
    'Followed instructions',
    'Used the right context',
    'Clear and concise',
    'Fast',
    'Other',
  ],
};

const RATING_OPTIONS: Array<{
  rating: BotReplyFeedbackRating;
  label: string;
  icon: 'ThumbsUp' | 'ThumbsDown';
}> = [
  { rating: 'up', label: 'Helpful', icon: 'ThumbsUp' },
  { rating: 'down', label: 'Not helpful', icon: 'ThumbsDown' },
];

export function BotFeedbackSheet({
  open,
  rating,
  onOpenChange,
  onRatingChange,
  onSubmit,
}: {
  open: boolean;
  rating: BotReplyFeedbackRating;
  onOpenChange: (open: boolean) => void;
  onRatingChange: (rating: BotReplyFeedbackRating) => Promise<void>;
  onSubmit: (categories: string[], details: string) => Promise<void>;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const [categories, setCategories] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [changingRating, setChangingRating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCategories([]);
      setDetails('');
      setError(null);
    }
  }, [open, rating]);

  const toggleCategory = (category: string) => {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category]
    );
  };

  const handleRatingChange = async (next: BotReplyFeedbackRating) => {
    if (next === rating || changingRating) return;
    setChangingRating(true);
    setError(null);
    try {
      await onRatingChange(next);
    } catch {
      setError('Feedback could not be updated. Please try again.');
    } finally {
      setChangingRating(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(categories, details);
      onOpenChange(false);
    } catch {
      setError('Feedback could not be sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const disclosure = (
    <Text
      size="$label/s"
      color="$tertiaryText"
      textAlign={isWindowNarrow ? 'center' : 'left'}
      flexShrink={1}
    >
      Your feedback and this thread are shared with Tlon.
      {!isWindowNarrow ? (
        <Text size="$label/s" color="$positiveActionText">
          {' '}
          Learn more
        </Text>
      ) : null}
    </Text>
  );

  const submitButton = (
    <Button
      preset="primary"
      size={isWindowNarrow ? 'medium' : 'small'}
      label="Send feedback"
      centered
      width={isWindowNarrow ? '100%' : 'auto'}
      minWidth={isWindowNarrow ? undefined : 128}
      disabled={submitting || changingRating}
      onPress={handleSubmit}
      testID="BotFeedbackDone"
    />
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Share feedback"
      modal
      closeButton
      keyboardBehavior="interactive"
      dialogContentProps={{ width: 480, minWidth: 420, maxWidth: 480 }}
    >
      <ActionSheet.ScrollableContent
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <YStack
          paddingTop={isWindowNarrow ? '$xl' : '$2xl'}
          paddingHorizontal="$2xl"
          gap="$xl"
        >
          <YStack gap="$xs" paddingRight={isWindowNarrow ? 0 : '$4xl'}>
            <Text size="$label/xl" fontWeight="600" color="$primaryText">
              Share feedback
            </Text>
            <Text size="$label/m" color="$secondaryText">
              {rating === 'up' ? 'What went well?' : 'What went wrong?'}
            </Text>
          </YStack>

          <XStack
            padding={3}
            borderRadius="$l"
            borderWidth={1}
            borderColor="$border"
            backgroundColor="$secondaryBackground"
          >
            {RATING_OPTIONS.map((option) => {
              const selected = option.rating === rating;
              const selectedColor =
                option.rating === 'up'
                  ? '$positiveActionText'
                  : '$negativeActionText';
              return (
                <Pressable
                  key={option.rating}
                  flex={1}
                  height={36}
                  borderRadius="$m"
                  borderWidth={1}
                  borderColor={selected ? '$border' : 'transparent'}
                  backgroundColor={selected ? '$background' : 'transparent'}
                  alignItems="center"
                  justifyContent="center"
                  disabled={changingRating || submitting}
                  onPress={() => void handleRatingChange(option.rating)}
                  pressStyle={{ opacity: 0.7 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                >
                  <XStack alignItems="center" gap="$s">
                    <Icon
                      type={option.icon}
                      customSize={[16, 16]}
                      color={selected ? selectedColor : '$secondaryText'}
                    />
                    <Text
                      size="$label/m"
                      color={selected ? selectedColor : '$secondaryText'}
                    >
                      {option.label}
                    </Text>
                  </XStack>
                </Pressable>
              );
            })}
          </XStack>

          <XStack
            flexWrap="wrap"
            gap="$s"
            alignContent="flex-start"
            minHeight={isWindowNarrow ? 152 : undefined}
          >
            {CATEGORIES[rating].map((category) => {
              const selected = categories.includes(category);
              return (
                <Pressable
                  key={category}
                  height={32}
                  paddingHorizontal="$m"
                  borderRadius="$xl"
                  borderWidth={1}
                  borderColor={selected ? '$positiveBorder' : '$border'}
                  backgroundColor={
                    selected ? '$positiveBackground' : '$background'
                  }
                  alignItems="center"
                  justifyContent="center"
                  onPress={() => toggleCategory(category)}
                  pressStyle={{ opacity: 0.7 }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={category}
                >
                  <XStack alignItems="center" gap="$xs">
                    <XStack
                      width={14}
                      height={14}
                      alignItems="center"
                      justifyContent="center"
                    >
                      {selected ? (
                        <Icon
                          type="Checkmark"
                          customSize={[14, 14]}
                          color="$positiveActionText"
                        />
                      ) : (
                        <Text size="$label/m" color="$secondaryText">
                          +
                        </Text>
                      )}
                    </XStack>
                    <Text
                      size="$label/m"
                      color={
                        selected ? '$positiveActionText' : '$secondaryText'
                      }
                    >
                      {category}
                    </Text>
                  </XStack>
                </Pressable>
              );
            })}
          </XStack>

          <TextInput
            multiline
            numberOfLines={4}
            value={details}
            onChangeText={setDetails}
            maxLength={4_000}
            placeholder="Share details (optional)"
            frameStyle={{
              minHeight: isWindowNarrow ? 88 : 96,
              alignItems: 'flex-start',
              paddingHorizontal: '$l',
            }}
            testID="BotFeedbackDetails"
          />

          {error ? (
            <Text size="$label/s" color="$negativeActionText">
              {error}
            </Text>
          ) : null}

          {isWindowNarrow ? (
            <YStack gap="$l">
              {submitButton}
              {disclosure}
            </YStack>
          ) : (
            <XStack alignItems="center" justifyContent="space-between" gap="$l">
              {disclosure}
              {submitButton}
            </XStack>
          )}
        </YStack>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
