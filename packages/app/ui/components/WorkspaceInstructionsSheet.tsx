import { useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { durableErrorText } from '@tloncorp/api/client/durable';
import type * as db from '@tloncorp/shared/db';
import { convertContent, markdownToStory } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Button, Text, useIsWindowNarrow, useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { ScrollView, XStack, YStack } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { BotPromptHeader } from './BotPromptHeader';
import { ControlledTextField, ControlledTextareaField } from './Form';
import { NotebookContentRenderer } from './NotebookPost/NotebookPost';

// Generous for free text, far below the host's 256 KB blob limit.
const MAX_INSTRUCTIONS_LENGTH = 10_000;

/** Whether a group's workspace config carries instructions. */
export function hasWorkspaceInstructions(group: db.Group) {
  return Boolean(api.readWorkspaceConfig(group.blob)?.instructions);
}

/** What an instructions editor shows and how it saves. */
export type InstructionsSheetProps = {
  /** The sheet's title. */
  title: string;
  /** What the instructions are for, and whose they are. */
  heading: string;
  meta?: string;
  description: string;
  storedText: string;
  /** False when the text can't be edited, with `blocked` saying why. */
  writable: boolean;
  /** False while saving waits on something else, such as a bot to name. */
  ready?: boolean;
  blocked?: string;
  /** The status line with nothing to save. */
  idleStatus: string;
  placeholder: string;
  accessibilityLabel: string;
  /** Asks for a nickname too, starting from this one. */
  nickname?: string;
  /** Above the fields, such as the agent's avatar. */
  header?: React.ReactNode;
  /** Something outside the form changed, such as a picked avatar. */
  changed?: boolean;
  saveLabel?: string;
  onSave: (values: { text: string; nickname?: string }) => Promise<void>;
  onClose: () => void;
  /** More settings, under the editor. */
  children?: React.ReactNode;
  testID?: string;
};

/**
 * Editor for instructions an agent loads on every turn: a Markdown text
 * with a preview, and optionally the agent's nickname.
 */
export function InstructionsSheet({
  title,
  heading,
  meta,
  description,
  storedText,
  writable,
  ready = true,
  blocked,
  idleStatus,
  placeholder,
  accessibilityLabel,
  nickname,
  header,
  changed = false,
  saveLabel = 'Save changes',
  onSave,
  onClose,
  children,
  testID = 'WorkspaceInstructions',
}: InstructionsSheetProps) {
  const showToast = useToast();
  const isWindowNarrow = useIsWindowNarrow();
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
    defaultValues: { text: storedText, nickname: nickname ?? '' },
  });

  // Take new stored text into the form unless a save is in flight or the
  // user has a draft of their own.
  useEffect(() => {
    if (saving || isDirty) {
      return;
    }
    reset({ text: storedText, nickname: nickname ?? '' });
  }, [isDirty, nickname, reset, saving, storedText]);

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

  const canSave =
    writable && ready && !blocked && (isDirty || changed) && isValid && !saving;

  const handleSave = useCallback(() => {
    if (!canSave) {
      return;
    }
    handleSubmit(async (values) => {
      setSaving(true);
      try {
        await onSave({
          text: values.text.trim(),
          ...(nickname !== undefined
            ? { nickname: values.nickname.trim() }
            : {}),
        });
      } catch (error) {
        setSaving(false);
        showToast({
          message: durableErrorText(error) ?? 'Failed to save instructions.',
          duration: 3000,
        });
        return;
      }
      showToast({ message: 'Changes saved.', duration: 3000 });
      setSaving(false);
      // Closes directly: handleOpenChange's mid-save guard still sees
      // `saving` as true in this closure.
      Keyboard.dismiss();
      onClose();
    })();
  }, [canSave, handleSubmit, nickname, onClose, onSave, showToast]);

  const editorHeight = isWindowNarrow ? 200 : 280;
  const statusMessage = saving
    ? 'Saving…'
    : (blocked ?? (isDirty ? 'Unsaved changes' : idleStatus));

  const saveButton = (
    <Button
      preset="primary"
      size={isWindowNarrow ? 'medium' : 'small'}
      label={saveLabel}
      loading={saving}
      disabled={!canSave}
      onPress={handleSave}
      centered
      width={isWindowNarrow ? '100%' : 'auto'}
      minWidth={isWindowNarrow ? undefined : 128}
      testID={`${testID}Save`}
    />
  );

  return (
    <ActionSheet
      open
      onOpenChange={handleOpenChange}
      title={title}
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
            <BotPromptHeader
              title={heading}
              meta={meta}
              description={description}
              paddingLeft="$xl"
              paddingRight={isWindowNarrow ? '$xl' : '$4xl'}
            />

            {header}

            {nickname !== undefined ? (
              <ControlledTextField
                name="nickname"
                control={control}
                label="Nickname"
                inputProps={{
                  accessibilityLabel: 'Nickname',
                  placeholder: 'Scout',
                  editable: !saving,
                  testID: `${testID}Nickname`,
                }}
                rules={{
                  validate: (value: string) =>
                    (value.trim().length >= 1 && value.trim().length <= 64) ||
                    'A nickname of 1 to 64 characters is required',
                }}
              />
            ) : null}

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
                  testID={`${testID}PreviewToggle`}
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
                  testID={`${testID}Preview`}
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
                    accessibilityLabel,
                    placeholder,
                    multiline: true,
                    minHeight: editorHeight,
                    textAlignVertical: 'top',
                    autoFocus: nickname === undefined,
                    editable: writable && !saving,
                    testID: `${testID}Editor`,
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

            {children}

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
  const parsed = useMemo(
    () => api.parseWorkspaceConfigBlob(group.blob),
    [group.blob]
  );
  const config = parsed.kind === 'config' ? parsed.config : null;
  const writable = parsed.kind === 'empty' || parsed.kind === 'config';

  const botsQuery = useQuery({
    queryKey: ['stewardBots'],
    queryFn: () => api.getStewardBots(),
    // Trust changes on the ship push nothing to the client; refetch per open.
    staleTime: 0,
    retry: false,
  });
  const bot = config?.bot ?? botsQuery.data?.[0] ?? null;

  const handleSave = useCallback(
    async ({ text }: { text: string }) => {
      if (!bot) {
        throw new Error('No Tlonbot');
      }
      await store.updateWorkspaceConfig(
        group.id,
        (current) => ({
          ...current,
          bot: current.bot ?? bot,
          instructions: text,
        }),
        { shouldThrow: true }
      );
    },
    [bot, group.id]
  );

  return (
    <InstructionsSheet
      title="Tlonbot instructions"
      heading="Instructions"
      meta={bot ?? undefined}
      description={`How your Tlonbot behaves in every channel of ${group.title || 'this group'}.`}
      storedText={config?.instructions ?? ''}
      writable={writable}
      ready={Boolean(bot)}
      blocked={
        !writable
          ? "This group's bot settings were saved by a newer version of the app. Update to edit them."
          : botsQuery.isSuccess && !bot
            ? 'You need a Tlonbot to set instructions for this group.'
            : undefined
      }
      idleStatus="Anyone in this group can read these."
      placeholder="How should your Tlonbot behave here?"
      accessibilityLabel="Tlonbot instructions"
      onSave={handleSave}
      onClose={onClose}
    />
  );
}
