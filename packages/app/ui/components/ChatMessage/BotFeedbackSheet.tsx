import type { BotReplyFeedbackRating } from '@tloncorp/api';
import { Button, Icon, Pressable, Text, useIsWindowNarrow } from '@tloncorp/ui';
import { useEffect, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { TextInput, ToggleGroupInput } from '../Form';
import type { ToggleGroupInputOption } from '../Form';

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

const RATING_OPTIONS: ToggleGroupInputOption<BotReplyFeedbackRating>[] = [
  {
    value: 'up',
    accessibilityLabel: 'Helpful',
    label: (selected) => (
      <XStack alignItems="center" gap="$s">
        <Icon
          type="ThumbsUp"
          customSize={[16, 16]}
          color={selected ? '$positiveActionText' : '$secondaryText'}
        />
        <Text
          size="$label/m"
          color={selected ? '$positiveActionText' : '$secondaryText'}
        >
          Helpful
        </Text>
      </XStack>
    ),
  },
  {
    value: 'down',
    accessibilityLabel: 'Not helpful',
    label: (selected) => (
      <XStack alignItems="center" gap="$s">
        <Icon
          type="ThumbsDown"
          customSize={[16, 16]}
          color={selected ? '$negativeActionText' : '$secondaryText'}
        />
        <Text
          size="$label/m"
          color={selected ? '$negativeActionText' : '$secondaryText'}
        >
          Not helpful
        </Text>
      </XStack>
    ),
  },
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
      flex={isWindowNarrow ? undefined : 1}
    >
      Your feedback and this thread are shared with Tlon.
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
      disabled={submitting}
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
      dialogContentProps={{ width: 576, minWidth: 520, maxWidth: 576 }}
    >
      <ActionSheet.ScrollableContent
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        // Native BottomSheetScrollView does not apply this prop to its content
        // container, so narrow-layout gutters live on the inner stack below.
        paddingHorizontal={isWindowNarrow ? 0 : '$3xl'}
      >
        <YStack
          paddingTop={isWindowNarrow ? '$xl' : '$3xl'}
          paddingHorizontal={isWindowNarrow ? '$2xl' : 0}
          paddingBottom={isWindowNarrow ? 0 : '$m'}
          gap={isWindowNarrow ? '$xl' : '$2xl'}
        >
          <YStack
            gap={isWindowNarrow ? '$xs' : '$s'}
            paddingRight={isWindowNarrow ? 0 : '$4xl'}
          >
            <Text size="$label/xl" fontWeight="600" color="$primaryText">
              Share feedback
            </Text>
            <Text size="$label/m" color="$secondaryText">
              {rating === 'up' ? 'What went well?' : 'What went wrong?'}
            </Text>
          </YStack>

          <ToggleGroupInput
            variant="inset"
            options={RATING_OPTIONS}
            value={rating}
            disabled={changingRating || submitting}
            onChange={(nextRating) => void handleRatingChange(nextRating)}
          />

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
            <XStack
              alignItems="center"
              justifyContent="space-between"
              gap="$2xl"
            >
              {disclosure}
              {submitButton}
            </XStack>
          )}
        </YStack>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
