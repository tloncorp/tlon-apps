import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { convertContent, markdownToStory } from '@tloncorp/shared';
import { Button, Icon, Text, useIsWindowNarrow, useToast } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { ScrollView, View, XStack, YStack } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { ControlledTextareaField } from './Form';
import { ListItem } from './ListItem';
import { NotebookContentRenderer } from './NotebookPost/NotebookPost';
import { SettingsDivider, SettingsSection } from './SettingsSection';

// One key for the whole ship-keyed map, which is what the endpoint returns.
// Keying per bot made every visited profile fetch and cache another copy of
// every bot's prompts; observers narrow to their own bot with `select`.
const promptsQueryKey = () => ['stewardPrompts'];
// A 404 can mean an old ship or a %steward that is briefly down, so spend the
// retries before believing either.
const PROMPTS_QUERY_RETRIES = 3;
const MAX_PROMPT_BYTES = 65_536;

const promptTextByteLength = (text: string) =>
  typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(text).length
    : text.length;

type BotSystemPrompt = { name: string; text: string };

const promptFilesForBot = (
  files: Record<string, Record<string, string>>,
  botShip: string
) =>
  Object.entries(files[botShip] ?? {}).map(([name, text]) => ({ name, text }));

/**
 * The prompt set mirrored into our own ship's %steward for this bot, or
 * null when there is none. Shared (and cached) between the profile's
 * prompts section and anything else that needs the ownership signal.
 */
export function useBotSystemPrompts(botShip: string) {
  return useQuery({
    queryKey: promptsQueryKey(),
    queryFn: api.getStewardPromptFiles,
    retry: PROMPTS_QUERY_RETRIES,
    select: (files) => promptFilesForBot(files, botShip),
  });
}

/**
 * True when this ship is a bot we own: our steward only mirrors prompt
 * sets for bots that configured us as their owner and that we explicitly
 * trusted, so mirror presence is itself the ownership signal.
 */
export function useIsOwnedBot(botShip: string) {
  // Keep the untransformed snapshot here: an empty projection means the bot
  // is still owned, even though there are no editable rows to render.
  const promptsQuery = useQuery({
    queryKey: promptsQueryKey(),
    queryFn: api.getStewardPromptFiles,
    retry: PROMPTS_QUERY_RETRIES,
  });
  // A ship with no prompts endpoint is a settled answer once the retries are
  // spent: nothing it mirrors can be owned, and holding this pending forever
  // would strip Block from every profile on that ship.
  const unsupported = promptsQuery.error instanceof api.PromptsUnsupportedError;
  return {
    isOwnedBot:
      promptsQuery.data !== undefined &&
      Object.prototype.hasOwnProperty.call(promptsQuery.data, botShip),
    // Failing open would expose Block for an owned bot after a transient
    // prompt read failure. Wait for a successful ownership read instead.
    isPending:
      promptsQuery.isPending ||
      promptsQuery.isFetching ||
      (promptsQuery.isError && !unsupported),
  };
}

/**
 * A short human label for the known prompt files; unknown names fall back
 * to the raw file name so new gateway-exposed prompts still render.
 */
const PROMPT_LABELS: Record<string, string> = {
  'AGENTS.md': 'Instructions',
  'SOUL.md': 'Personality',
  'TOOLS.md': 'Tools',
  'IDENTITY.md': 'Identity',
  'USER.md': 'About you',
  'BOOTSTRAP.md': 'Bootstrap',
};

const PROMPT_DESCRIPTIONS: Record<string, string> = {
  'AGENTS.md': 'Core instructions for how your bot behaves.',
  'SOUL.md': "Your bot's personality and tone.",
  'TOOLS.md': 'Guidance for the tools your bot can use.',
  'IDENTITY.md': 'How your bot identifies itself.',
  'USER.md': 'What your bot knows about you.',
  'BOOTSTRAP.md': 'First-run setup instructions for your bot.',
};

const PROMPT_ORDER = [
  'AGENTS.md',
  'SOUL.md',
  'IDENTITY.md',
  'USER.md',
  'TOOLS.md',
  'BOOTSTRAP.md',
];

const promptOrder = new Map(
  PROMPT_ORDER.map((name, index) => [name, index] as const)
);
/**
 * System prompt list + editor for an owned bot's profile screen. Reads the
 * prompt set mirrored into our own ship's %steward and edits via the
 * %steward relay — the ship stores the edit durably and the bot's gateway
 * applies it and restarts. Renders nothing when the ship (or the bot's
 * gateway) doesn't support prompt sync yet.
 */
export function BotSystemPromptsSection({ botShip }: { botShip: string }) {
  const queryClient = useQueryClient();
  const promptsQuery = useBotSystemPrompts(botShip);
  // Hold the name, not the row: the feed can change or delete this prompt
  // while the sheet is open, and a captured row would keep showing (and then
  // save over) text that is no longer current.
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingBaseText, setEditingBaseText] = useState<string | null>(null);

  // The workspace feed is authoritative. A successful edit only confirms
  // the workspace write; an update from this feed supplies its contents.
  useEffect(() => {
    let subscriptionId: number | null = null;
    let cancelled = false;
    api
      .subscribeToStewardPrompts(
        (update) => {
          if ('files' in update) {
            const files = update.files;
            // A read started before this fact can still be in flight, and it
            // would overwrite this newer snapshot on arrival — permanently,
            // since nothing goes stale on its own and no later fact is promised.
            void (async () => {
              await queryClient.cancelQueries({ queryKey: promptsQueryKey() });
              if (cancelled) {
                return;
              }
              queryClient.setQueryData(promptsQueryKey(), files);
            })();
          } else if (
            ('set' in update && update.set.ship === botShip) ||
            ('del' in update && update.del.ship === botShip) ||
            ('gone' in update && update.gone.ship === botShip)
          ) {
            queryClient.invalidateQueries({
              queryKey: promptsQueryKey(),
            });
          }
        },
        () => {
          // %steward kicked this watch (a desk restart, say). The client
          // resubscribes for us, but whatever it emitted meanwhile is lost and
          // nothing else would ever refresh this cache.
          if (!cancelled) {
            queryClient.invalidateQueries({ queryKey: promptsQueryKey() });
          }
        }
      )
      .then((id) => {
        if (id === null) {
          return;
        }
        if (cancelled) {
          api.unsubscribe(id);
          return;
        }
        subscriptionId = id;
        queryClient.invalidateQueries({ queryKey: promptsQueryKey() });
      })
      .catch(() => {
        // No live updates from here on. A projection cached on an earlier
        // visit is fresh forever, so this mount may have issued no read at
        // all; refresh explicitly rather than leaving the editor and the
        // ownership signal on whatever that visit saw.
        queryClient.invalidateQueries({ queryKey: promptsQueryKey() });
      });
    return () => {
      cancelled = true;
      if (subscriptionId !== null) {
        api.unsubscribe(subscriptionId);
      }
    };
  }, [botShip, queryClient]);

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: promptsQueryKey() });
  }, [queryClient]);

  const handleCloseEditor = useCallback(() => {
    setEditingName(null);
    setEditingBaseText(null);
  }, []);

  const prompts = promptsQuery.data;
  if (!prompts || prompts.length === 0) {
    return null;
  }

  // Resolved against the live query every render, so an edit or deletion
  // arriving on the feed reaches the open sheet instead of being saved over.
  const editing =
    editingName === null
      ? null
      : (prompts.find((prompt) => prompt.name === editingName) ?? null);

  const orderedPrompts = [...prompts].sort((a, b) => {
    const aOrder = promptOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = promptOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.name.localeCompare(b.name);
  });

  return (
    <View paddingHorizontal="$xl" width="100%">
      <SettingsSection
        title="Bot behavior"
        description="Saving a prompt briefly restarts your bot."
      >
        {orderedPrompts.map((prompt, index) => (
          <Fragment key={prompt.name}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${PROMPT_LABELS[prompt.name] ?? prompt.name} prompt`}
              onPress={() => {
                setEditingName(prompt.name);
                setEditingBaseText(prompt.text);
              }}
              pressStyle={{ backgroundColor: '$secondaryBackground' }}
            >
              <ListItem
                alignItems="center"
                backgroundColor="$transparent"
                paddingHorizontal="$xl"
                paddingVertical="$m"
              >
                <ListItem.MainContent>
                  <ListItem.Title>
                    {PROMPT_LABELS[prompt.name] ?? prompt.name}
                  </ListItem.Title>
                  <ListItem.Subtitle numberOfLines={1}>
                    {PROMPT_DESCRIPTIONS[prompt.name] ??
                      'Additional instructions for your bot.'}
                  </ListItem.Subtitle>
                </ListItem.MainContent>
                <XStack alignItems="center" gap="$m" flexShrink={0}>
                  <Icon type="ChevronRight" size="$m" color="$tertiaryText" />
                </XStack>
              </ListItem>
            </Pressable>
            {index < orderedPrompts.length - 1 ? <SettingsDivider /> : null}
          </Fragment>
        ))}
      </SettingsSection>
      {editing ? (
        <BotSystemPromptEditorSheet
          botShip={botShip}
          prompt={editing}
          // Keyed by name only. Keying on the text too remounted the sheet
          // whenever the projection changed — including on the fact for the
          // edit being saved — which reset `saving` and reopened the
          // dismiss/double-submit race the guard exists to prevent.
          key={editing.name}
          changedElsewhere={
            editingBaseText !== null && editingBaseText !== editing.text
          }
          onClose={handleCloseEditor}
          onSaved={handleSaved}
        />
      ) : null}
    </View>
  );
}

function BotSystemPromptEditorSheet({
  botShip,
  prompt,
  changedElsewhere,
  onClose,
  onSaved,
}: {
  botShip: string;
  prompt: BotSystemPrompt;
  changedElsewhere: boolean;
  onClose: () => void;
  onSaved: (name: string, text: string) => void;
}) {
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
    formState: { isDirty },
  } = useForm({
    mode: 'onChange',
    defaultValues: { text: prompt.text },
  });

  // Take a new projection into the form in place of remounting. Held back
  // while a save is in flight (that state must survive) and while the user
  // has unsaved edits (their draft is theirs to keep) — `changedElsewhere`
  // tells them the stored text moved on in the meantime.
  useEffect(() => {
    if (saving || isDirty) {
      return;
    }
    reset({ text: prompt.text });
  }, [isDirty, prompt.text, reset, saving]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }
      // The close button, Escape, the overlay and the pan gesture all land
      // here. Dismissing mid-save would hide a write that still completes,
      // and reopening could leave two of them racing.
      if (saving) {
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
        error: 'Unable to render this prompt as Markdown.',
      });
    }
    setIsPreviewing(true);
  }, [getValues, isPreviewing]);

  const handleSave = useCallback(() => {
    if (!isDirty || saving) {
      return;
    }
    handleSubmit(async ({ text }) => {
      // %steward nacks oversized text; check up front for a real error
      // message instead of a failed poke.
      if (promptTextByteLength(text) > MAX_PROMPT_BYTES) {
        showToast({
          message: 'Prompt is too long. The limit is 64 KB.',
          duration: 3000,
        });
        return;
      }
      setSaving(true);
      try {
        try {
          await api.setStewardPrompt({ bot: botShip, name: prompt.name, text });
        } catch (error) {
          if (!(error instanceof api.StewardPromptPendingError)) {
            throw error;
          }
          await api.awaitStewardPromptRequest(error.requestId);
        }
        onSaved(prompt.name, text);
        showToast({
          message: 'Changes saved.',
          duration: 3000,
        });
        setSaving(false);
        // Closes directly rather than through handleOpenChange, whose
        // mid-save guard still sees `saving` as true in this closure.
        Keyboard.dismiss();
        onClose();
      } catch (error) {
        setSaving(false);
        showToast({ message: 'Failed to save prompt.', duration: 3000 });
      }
    })();
  }, [
    botShip,
    handleSubmit,
    isDirty,
    onClose,
    onSaved,
    prompt.name,
    saving,
    showToast,
  ]);

  const title = PROMPT_LABELS[prompt.name] ?? prompt.name;
  const editorHeight = isWindowNarrow ? 200 : 280;
  const statusMessage = saving
    ? 'Saving and restarting your bot…'
    : changedElsewhere
      ? 'This prompt changed elsewhere. Showing the latest version.'
      : isDirty
        ? 'Unsaved changes'
        : 'Saving briefly restarts your bot.';

  const saveButton = (
    <Button
      preset="primary"
      size={isWindowNarrow ? 'medium' : 'small'}
      label="Save changes"
      loading={saving}
      disabled={!isDirty || saving}
      onPress={handleSave}
      centered
      width={isWindowNarrow ? '100%' : 'auto'}
      minWidth={isWindowNarrow ? undefined : 128}
      testID="BotSystemPromptSave"
    />
  );

  return (
    <ActionSheet
      open
      onOpenChange={handleOpenChange}
      title={`Edit ${title}`}
      modal
      closeButton
      keyboardBehavior="interactive"
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
                  {title}
                </Text>
                <Text
                  size="$label/s"
                  color="$tertiaryText"
                  flexShrink={0}
                  numberOfLines={1}
                >
                  {prompt.name}
                </Text>
              </XStack>
              <Text size="$label/m" color="$secondaryText">
                {PROMPT_DESCRIPTIONS[prompt.name] ??
                  'Additional instructions for your bot.'}
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
                  Prompt
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
                      ? 'Edit prompt'
                      : 'Preview rendered Markdown prompt'
                  }
                  testID="BotSystemPromptPreviewToggle"
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
                  testID="BotSystemPromptPreview"
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
                        testID="BotSystemPromptPreviewContent"
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
                    accessibilityLabel: `${title} prompt`,
                    placeholder: 'Write the prompt…',
                    multiline: true,
                    minHeight: editorHeight,
                    textAlignVertical: 'top',
                    autoFocus: true,
                    testID: 'BotSystemPromptEditor',
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
                gap="$2xl"
              >
                <Text
                  size="$label/s"
                  color={isDirty ? '$primaryText' : '$secondaryText'}
                  accessibilityLiveRegion="polite"
                  flex={1}
                >
                  {statusMessage}
                </Text>
                <XStack alignItems="center" gap="$m">
                  <Button
                    preset="minimal"
                    size="small"
                    label="Cancel"
                    disabled={saving}
                    onPress={() => handleOpenChange(false)}
                  />
                  {saveButton}
                </XStack>
              </XStack>
            )}
          </YStack>
        </ActionSheet.FormBlock>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
