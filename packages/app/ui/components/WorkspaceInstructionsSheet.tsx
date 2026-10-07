import { useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import type * as db from '@tloncorp/shared/db';
import { convertContent, markdownToStory } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Button, Text, useIsWindowNarrow, useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { ScrollView, XStack, YStack } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { ControlledTextareaField } from './Form';
import { NotebookContentRenderer } from './NotebookPost/NotebookPost';

// Generous for free text, far below the host's 256 KB blob limit.
const MAX_INSTRUCTIONS_LENGTH = 10_000;

/** Whether a group's workspace config carries instructions. */
export function hasWorkspaceInstructions(group: db.Group) {
  return Boolean(api.readWorkspaceConfig(group.blob)?.instructions);
}

/**
 * Editor for a group's workspace instructions: free text the group's bot
 * loads on every turn in the group's channels. Saving names the bot the
 * workspace is for when the config has none: the owner's first trusted bot.
 */
export function WorkspaceInstructionsSheet({
  group,
  onClose,
}: {
  group: db.Group;
  onClose: () => void;
}) {
  const showToast = useToast();
  const isWindowNarrow = useIsWindowNarrow();

  const parsed = useMemo(
    () => api.parseWorkspaceConfigBlob(group.blob),
    [group.blob]
  );
  const config = parsed.kind === 'config' ? parsed.config : null;
  const writable = parsed.kind === 'empty' || parsed.kind === 'config';
  const storedText = config?.instructions ?? '';

  const botsQuery = useQuery({
    queryKey: ['stewardBots'],
    queryFn: () => api.getStewardBots(),
    retry: false,
  });
  const bot = config?.bot ?? botsQuery.data?.[0] ?? null;

  const [saving, setSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewState, setPreviewState] = useState<{
    content: ReturnType<typeof convertContent>;
    error: string | null;
  }>({ content: [], error: null });
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    formState: { isDirty, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: { text: storedText },
  });

  // Take a new blob into the form unless a save is in flight or the user
  // has a draft of their own.
  useEffect(() => {
    if (saving || isDirty) {
      return;
    }
    reset({ text: storedText });
  }, [isDirty, reset, saving, storedText]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Dismissing mid-save would hide a write that still completes.
      if (open || saving) {
        return;
      }
      Keyboard.dismiss();
      onClose();
    },
    [onClose, saving]
  );

  const handleTogglePreview = useCallback(() => {
    if (isPreviewing) {
      setIsPreviewing(false);
      return;
    }
    Keyboard.dismiss();
    try {
      setPreviewState({
        content: convertContent(markdownToStory(getValues('text')), null),
        error: null,
      });
    } catch {
      setPreviewState({
        content: [],
        error: 'Unable to render these instructions as Markdown.',
      });
    }
    setIsPreviewing(true);
  }, [getValues, isPreviewing]);

  const canSave = writable && Boolean(bot) && isDirty && isValid && !saving;

  const handleSave = useCallback(() => {
    if (!canSave || !bot) {
      return;
    }
    handleSubmit(async ({ text }) => {
      setSaving(true);
      try {
        await store.updateWorkspaceConfig(
          group.id,
          (current) => ({
            ...current,
            bot: current.bot ?? bot,
            instructions: text.trim(),
          }),
          { shouldThrow: true }
        );
      } catch {
        setSaving(false);
        showToast({ message: 'Failed to save instructions.', duration: 3000 });
        return;
      }
      showToast({ message: 'Changes saved.', duration: 3000 });
      setSaving(false);
      // Closes directly: handleOpenChange's mid-save guard still sees
      // `saving` as true in this closure.
      Keyboard.dismiss();
      onClose();
    })();
  }, [bot, canSave, group.id, handleSubmit, onClose, showToast]);

  const editorHeight = isWindowNarrow ? 200 : 280;
  const statusMessage = saving
    ? 'Saving…'
    : !writable
      ? "This group's bot settings were saved by a newer version of the app. Update to edit them."
      : botsQuery.error instanceof api.DeskUnsupportedError
        ? 'Update your ship to set instructions for your bot.'
        : botsQuery.isSuccess && !bot
          ? 'You need a bot to set instructions for this group.'
          : isDirty
            ? 'Unsaved changes'
            : 'Anyone in this group can read these.';

  const saveButton = (
    <Button
      preset="primary"
      size={isWindowNarrow ? 'medium' : 'small'}
      label="Save changes"
      loading={saving}
      disabled={!canSave}
      onPress={handleSave}
      centered
      width={isWindowNarrow ? '100%' : 'auto'}
      minWidth={isWindowNarrow ? undefined : 128}
      testID="WorkspaceInstructionsSave"
    />
  );

  return (
    <ActionSheet
      open
      onOpenChange={handleOpenChange}
      title="Edit bot instructions"
      modal
      closeButton
      dialogContentProps={{ width: 576, minWidth: 520, maxWidth: 576 }}
    >
      <ActionSheet.ScrollableContent
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <ActionSheet.FormBlock
          paddingHorizontal={isWindowNarrow ? '$2xl' : '$3xl'}
          paddingTop={isWindowNarrow ? '$xl' : '$3xl'}
          paddingBottom={isWindowNarrow ? 0 : '$m'}
        >
          <YStack gap={isWindowNarrow ? '$xl' : '$2xl'}>
            <YStack
              gap="$xs"
              paddingLeft="$xl"
              paddingRight={isWindowNarrow ? '$xl' : '$4xl'}
            >
              <XStack alignItems="baseline" gap="$l">
                <Text
                  size="$label/xl"
                  fontWeight="600"
                  color="$primaryText"
                  flex={1}
                  minWidth={0}
                  numberOfLines={1}
                >
                  Bot instructions
                </Text>
                {bot ? (
                  <Text
                    size="$label/s"
                    color="$tertiaryText"
                    flexShrink={0}
                    numberOfLines={1}
                  >
                    {bot}
                  </Text>
                ) : null}
              </XStack>
              <Text size="$label/m" color="$secondaryText">
                How your bot behaves in every channel of{' '}
                {group.title || 'this group'}.
              </Text>
            </YStack>

            <YStack>
              <XStack
                minHeight="$4xl"
                alignItems="center"
                justifyContent="space-between"
                paddingLeft="$xl"
                gap="$l"
              >
                <Text size="$label/m" color="$tertiaryText">
                  Instructions
                </Text>
                <Button
                  preset="secondary"
                  size="small"
                  label={isPreviewing ? 'Edit' : 'Preview'}
                  disabled={saving}
                  onPress={handleTogglePreview}
                  centered
                  accessibilityLabel={
                    isPreviewing
                      ? 'Edit instructions'
                      : 'Preview rendered Markdown instructions'
                  }
                  testID="WorkspaceInstructionsPreviewToggle"
                />
              </XStack>

              {isPreviewing ? (
                <ScrollView
                  height={editorHeight}
                  maxHeight={editorHeight}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$l"
                  backgroundColor="$background"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  testID="WorkspaceInstructionsPreview"
                >
                  <YStack
                    minHeight="100%"
                    paddingHorizontal="$xl"
                    paddingVertical="$l"
                  >
                    {previewState.error ? (
                      <YStack gap="$xs">
                        <Text
                          size="$label/l"
                          fontWeight="500"
                          color="$primaryText"
                        >
                          Preview unavailable
                        </Text>
                        <Text size="$label/m" color="$secondaryText">
                          {previewState.error}
                        </Text>
                      </YStack>
                    ) : previewState.content.length > 0 ? (
                      <NotebookContentRenderer
                        content={previewState.content}
                        marginHorizontal="$-l"
                      />
                    ) : (
                      <Text size="$body" color="$tertiaryText">
                        Nothing to preview yet.
                      </Text>
                    )}
                  </YStack>
                </ScrollView>
              ) : (
                <ControlledTextareaField
                  name="text"
                  control={control}
                  inputProps={{
                    accessibilityLabel: 'Bot instructions',
                    placeholder: 'How should your bot behave here?',
                    multiline: true,
                    minHeight: editorHeight,
                    textAlignVertical: 'top',
                    autoFocus: true,
                    editable: writable && !saving,
                    testID: 'WorkspaceInstructionsEditor',
                  }}
                  rules={{
                    maxLength: {
                      value: MAX_INSTRUCTIONS_LENGTH,
                      message: `Instructions are limited to ${MAX_INSTRUCTIONS_LENGTH.toLocaleString()} characters`,
                    },
                  }}
                />
              )}
            </YStack>

            {isWindowNarrow ? (
              <YStack gap="$m">
                <Text
                  size="$label/s"
                  color={isDirty ? '$primaryText' : '$secondaryText'}
                  accessibilityLiveRegion="polite"
                >
                  {statusMessage}
                </Text>
                {saveButton}
                <Button
                  preset="minimal"
                  label="Cancel"
                  disabled={saving}
                  onPress={() => handleOpenChange(false)}
                  centered
                />
              </YStack>
            ) : (
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$l"
                paddingLeft="$xl"
              >
                <Text
                  size="$label/s"
                  color={isDirty ? '$primaryText' : '$secondaryText'}
                  flex={1}
                  accessibilityLiveRegion="polite"
                >
                  {statusMessage}
                </Text>
                {saveButton}
              </XStack>
            )}
          </YStack>
        </ActionSheet.FormBlock>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
