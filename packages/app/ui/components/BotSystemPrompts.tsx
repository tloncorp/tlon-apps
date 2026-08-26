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

const promptsQueryKey = (botShip: string) => ['botSystemPrompts', botShip];

// Hermes and browsers both provide TextEncoder; the char-count fallback
// undercounts multibyte text but the ship still enforces the real cap.
const promptTextByteLength = (text: string) =>
  typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(text).length
    : text.length;

/**
 * The prompt set mirrored into our own ship's %steward for this bot, or
 * null when there is none. Shared (and cached) between the profile's
 * prompts section and anything else that needs the ownership signal.
 */
export function useBotSystemPrompts(botShip: string) {
  return useQuery({
    queryKey: promptsQueryKey(botShip),
    queryFn: () => api.getBotSystemPrompts(botShip),
  });
}

/**
 * True when this ship is a bot we own: our steward only mirrors prompt
 * sets for bots that configured us as their owner and that we explicitly
 * trusted, so mirror presence is itself the ownership signal.
 */
export function useIsOwnedBot(botShip: string) {
  const promptsQuery = useBotSystemPrompts(botShip);
  return {
    isOwnedBot: Boolean(promptsQuery.data?.length),
    /**
     * True while a fetch is deciding — the first load OR a background
     * refetch (staleTime is Infinity, so a refetch only follows an
     * explicit invalidation and genuinely may change the answer: a cached
     * "not owned" can be about to flip after the bot was trusted while
     * the profile was unmounted). Callers gating a destructive action
     * (e.g. Block) should treat ownership as unknown until this settles.
     */
    isPending: promptsQuery.isPending || promptsQuery.isFetching,
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
  const [editing, setEditing] = useState<api.BotSystemPrompt | null>(null);

  // Refresh when the bot's canonical set fans back into our mirror (a seed
  // after gateway restart, or an edit confirmation). staleTime is Infinity
  // repo-wide, so explicit invalidation is the only refresh path — the
  // subscription must be live even before the first seed exists, or a bot's
  // very first seed would stay invisible for the rest of the session.
  useEffect(() => {
    let subscriptionId: number | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const start = () => {
      api
        .subscribeToBotSystemPrompts(
          (changedBot, prompts) => {
            if (changedBot === botShip) {
              // The fact carries the authoritative set, so write it into
              // the cache directly instead of refetching — an emptied
              // mirror (untrust / owner revocation) must clear the editor
              // even when a follow-up scry would fail.
              queryClient.setQueryData(promptsQueryKey(botShip), prompts);
            }
          },
          {
            onQuit: () => {
              if (cancelled) {
                return;
              }
              // The agent quit the watch (desk restart/upgrade). Passing
              // onQuit disabled the client's auto-resubscribe, so recovery
              // is ours: re-run the mount flow — subscribe fresh, then the
              // post-subscribe invalidation below re-scries past whatever
              // the gap dropped.
              subscriptionId = null;
              attempt = 0;
              retryTimer = setTimeout(start, 0);
            },
          }
        )
        .then((id) => {
          if (id === null) {
            // Ship lacks the prompts module — permanent for this session,
            // so no retry. Authoritative either way: if a downgraded /
            // replaced desk removed the module after we cached a prompt
            // set, that cache would otherwise stay fresh (and the editor
            // visible) for the rest of the session.
            queryClient.setQueryData(promptsQueryKey(botShip), null);
            return;
          }
          if (cancelled) {
            api.unsubscribe(id);
            return;
          }
          subscriptionId = id;
          // Close the backfill-to-watch gap: a %sync that landed after the
          // initial scry but before this subscription registered would
          // otherwise stay invisible forever (staleTime is Infinity).
          queryClient.invalidateQueries({ queryKey: promptsQueryKey(botShip) });
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          // Transient failure (module-less ships resolve null instead of
          // rejecting). Without a live subscription nothing ever
          // invalidates this query again, so retry with capped backoff
          // rather than staying stale until the profile remounts.
          const delayMs = Math.min(30_000, 2_000 * 2 ** attempt);
          attempt += 1;
          retryTimer = setTimeout(start, delayMs);
        });
    };
    start();
    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
      }
      if (subscriptionId !== null) {
        api.unsubscribe(subscriptionId);
      }
    };
  }, [botShip, queryClient]);

  const handleSaved = useCallback(
    (name: string, text: string) => {
      // The poke was accepted by our ship; reflect it immediately rather
      // than waiting for the bot's sync fact (the gateway restart delays it).
      queryClient.setQueryData(
        promptsQueryKey(botShip),
        (current: api.BotSystemPrompt[] | null | undefined) =>
          current?.map((prompt) =>
            prompt.name === name
              ? { ...prompt, text, updatedAt: Date.now(), edited: true }
              : prompt
          ) ?? current
      );
    },
    [botShip, queryClient]
  );

  const prompts = promptsQuery.data;
  if (!prompts || prompts.length === 0) {
    return null;
  }

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
              onPress={() => setEditing(prompt)}
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
                  {prompt.edited ? (
                    <Text size="$label/s" color="$secondaryText">
                      Customized
                    </Text>
                  ) : null}
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
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </View>
  );
}

function BotSystemPromptEditorSheet({
  botShip,
  prompt,
  onClose,
  onSaved,
}: {
  botShip: string;
  prompt: api.BotSystemPrompt;
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
    formState: { isDirty },
  } = useForm({
    mode: 'onChange',
    defaultValues: { text: prompt.text },
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        Keyboard.dismiss();
        onClose();
      }
    },
    [onClose]
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
      if (promptTextByteLength(text) > api.MAX_PROMPT_TEXT_BYTES) {
        showToast({
          message: 'Prompt is too long. The limit is 64 KB.',
          duration: 3000,
        });
        return;
      }
      setSaving(true);
      try {
        await api.setBotSystemPrompt({ botShip, name: prompt.name, text });
        onSaved(prompt.name, text);
        showToast({
          message: 'Changes saved. Tlonbot restarting to apply them',
          duration: 3000,
        });
        setSaving(false);
        handleOpenChange(false);
      } catch (error) {
        setSaving(false);
        showToast({ message: 'Failed to save prompt.', duration: 3000 });
      }
    })();
  }, [
    botShip,
    handleOpenChange,
    handleSubmit,
    isDirty,
    onSaved,
    prompt.name,
    saving,
    showToast,
  ]);

  const title = PROMPT_LABELS[prompt.name] ?? prompt.name;
  const editorHeight = isWindowNarrow ? 200 : 280;
  const statusMessage = saving
    ? 'Saving and restarting your bot…'
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
