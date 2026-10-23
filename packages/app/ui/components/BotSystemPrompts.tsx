import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { convertContent, markdownToStory } from '@tloncorp/shared';
import { Button, Text, useIsWindowNarrow, useToast } from '@tloncorp/ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { ScrollView, XStack, YStack } from 'tamagui';

import { useCurrentUserId } from '../contexts/appDataContext';
import { ActionSheet } from './ActionSheet';
import { BotPromptHeader } from './BotPromptHeader';
import { joinPromptFile, promptLabel, splitPromptFile } from './botPromptFiles';
import { ControlledTextareaField } from './Form';
import { NotebookContentRenderer } from './NotebookPost/NotebookPost';

// One key for the whole ship-keyed map, which is what the endpoint returns.
// Keying per bot made every visited profile fetch and cache another copy of
// every bot's prompts; observers narrow to their own bot with `select`. The
// connected ship is in it: the map is that ship's mirror, and the cache
// outlives a switch to another account.
const promptsQueryKey = (ship: string) => ['stewardPrompts', ship];
// A 404 can mean an old ship or a %steward that is briefly down, so spend the
// retries before believing either. A desk version below the prompts module
// is already a settled answer.
const PROMPTS_QUERY_RETRIES = 3;
const retryPromptsQuery = (failureCount: number, error: Error) =>
  !(error instanceof api.DeskUnsupportedError) &&
  failureCount < PROMPTS_QUERY_RETRIES;
const MAX_PROMPT_BYTES = 65_536;

const promptTextByteLength = (text: string) =>
  typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(text).length
    : text.length;

export type BotSystemPrompt = { name: string; text: string };

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
  const currentUserId = useCurrentUserId();
  return useQuery({
    queryKey: promptsQueryKey(currentUserId),
    queryFn: api.getStewardPromptFiles,
    retry: retryPromptsQuery,
    select: (files) => promptFilesForBot(files, botShip),
  });
}

/**
 * True when this ship is a bot we own: our steward only mirrors prompt
 * sets for bots that configured us as their owner and that we explicitly
 * trusted, so mirror presence is itself the ownership signal.
 */
// Known false on a desk below the prompts module, including one rolled back
// to it. Its every prompts request is refused, but a snapshot cached while it
// was supported never goes stale on its own, so readers gate on this too.
export function useDeskSupportsPrompts() {
  return useSyncExternalStore(
    api.onDeskSupportsStewardPromptsChange,
    api.getDeskSupportsStewardPromptsState
  );
}

export function useIsOwnedBot(botShip: string) {
  const currentUserId = useCurrentUserId();
  const deskSupportsPrompts = useDeskSupportsPrompts();
  // Keep the untransformed snapshot here: an empty projection means the bot
  // is still owned, even though there are no editable rows to render.
  const promptsQuery = useQuery({
    queryKey: promptsQueryKey(currentUserId),
    queryFn: api.getStewardPromptFiles,
    retry: retryPromptsQuery,
  });
  if (deskSupportsPrompts === false) {
    return { isOwnedBot: false, isPending: false };
  }
  // A ship with no prompts endpoint is a settled answer once the retries are
  // spent: nothing it mirrors can be owned, and holding this pending forever
  // would strip Block from every profile on that ship.
  const unsupported =
    promptsQuery.error instanceof api.PromptsUnsupportedError ||
    promptsQuery.error instanceof api.DeskUnsupportedError;
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
 * Keeps the cached prompt projection live while mounted, by following
 * %steward's prompts feed. Every surface that shows prompts mounts it.
 */
export function useStewardPromptsFeed(botShip: string) {
  const queryClient = useQueryClient();
  const currentUserId = useCurrentUserId();
  // A desk upgrade can turn prompt support on while a prompt surface is open,
  // after the read and the watch were already refused. Resubscribing on a
  // change also refreshes the read, which nothing else would retry.
  const deskSupportsPrompts = useDeskSupportsPrompts();

  // The workspace feed is authoritative. A successful edit only confirms
  // the workspace write; an update from this feed supplies its contents.
  useEffect(() => {
    if (deskSupportsPrompts === false) {
      return;
    }
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
              await queryClient.cancelQueries({
                queryKey: promptsQueryKey(currentUserId),
              });
              if (cancelled) {
                return;
              }
              queryClient.setQueryData(promptsQueryKey(currentUserId), files);
            })();
          } else if (
            ('set' in update && update.set.ship === botShip) ||
            ('del' in update && update.del.ship === botShip) ||
            ('gone' in update && update.gone.ship === botShip)
          ) {
            queryClient.invalidateQueries({
              queryKey: promptsQueryKey(currentUserId),
            });
          }
        },
        () => {
          // %steward kicked this watch (a desk restart, say). The client
          // resubscribes for us, but whatever it emitted meanwhile is lost and
          // nothing else would ever refresh this cache.
          if (!cancelled) {
            queryClient.invalidateQueries({
              queryKey: promptsQueryKey(currentUserId),
            });
          }
        },
        () => {
          // %steward refused the watch after it was sent: the same loss of
          // live updates as the catch below, so refresh the same way.
          subscriptionId = null;
          if (!cancelled) {
            queryClient.invalidateQueries({
              queryKey: promptsQueryKey(currentUserId),
            });
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
        queryClient.invalidateQueries({
          queryKey: promptsQueryKey(currentUserId),
        });
      })
      .catch(() => {
        // No live updates from here on. A projection cached on an earlier
        // visit is fresh forever, so this mount may have issued no read at
        // all; refresh explicitly rather than leaving the editor and the
        // ownership signal on whatever that visit saw.
        queryClient.invalidateQueries({
          queryKey: promptsQueryKey(currentUserId),
        });
      });
    return () => {
      cancelled = true;
      if (subscriptionId !== null) {
        api.unsubscribe(subscriptionId);
      }
    };
  }, [botShip, currentUserId, deskSupportsPrompts, queryClient]);
}

/**
 * Refetches the prompt projection. A save only confirms the workspace write;
 * the feed, or this read, supplies what the bot now runs on.
 */
export function useRefreshStewardPrompts() {
  const queryClient = useQueryClient();
  const currentUserId = useCurrentUserId();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: promptsQueryKey(currentUserId) });
  }, [currentUserId, queryClient]);
}

/**
 * True when this bot has prompt files mirrored into our ship, which is what
 * the profile's link to them waits on. Follows the feed while mounted, so the
 * link, and the ownership signal read from the same cache, stay current.
 */
export function useHasBotPromptFiles(botShip: string) {
  const promptsQuery = useBotSystemPrompts(botShip);
  const deskSupportsPrompts = useDeskSupportsPrompts();
  useStewardPromptsFeed(botShip);
  return deskSupportsPrompts !== false && (promptsQuery.data?.length ?? 0) > 0;
}

/**
 * Saves one prompt file through %steward. The id a save of this exact text
 * went out under is kept until the ship gives it a definite answer: a POST
 * that reached %steward but lost its reply is resent under the same id, which
 * the ship answers from its record instead of running the edit a second time.
 */
export function useStewardPromptSave(botShip: string, name: string) {
  const unsettledRequestRef = useRef<{
    requestId: string;
    bot: string;
    name: string;
    text: string;
  } | null>(null);
  return useCallback(
    async (text: string) => {
      const unsettled = unsettledRequestRef.current;
      const requestId =
        unsettled?.bot === botShip &&
        unsettled.name === name &&
        unsettled.text === text
          ? unsettled.requestId
          : api.mintRequestId();
      unsettledRequestRef.current = { requestId, bot: botShip, name, text };
      try {
        try {
          await api.setStewardPrompt({ bot: botShip, name, text, requestId });
        } catch (error) {
          if (!(error instanceof api.StewardPromptPendingError)) {
            throw error;
          }
          await api.awaitStewardPromptRequest(error.requestId);
        }
        unsettledRequestRef.current = null;
      } catch (error) {
        // The ship's own answer settles the request: resending it would only
        // replay that answer, so a retry gets a new id.
        if (error instanceof api.StewardPromptEditError) {
          unsettledRequestRef.current = null;
        }
        throw error;
      }
    },
    [botShip, name]
  );
}

/**
 * Edits the owner's additions to a prompt file: the text outside Tlon's
 * managed blocks, which a save keeps as they are.
 */
export function BotSystemPromptEditorSheet({
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
  const savePrompt = useStewardPromptSave(botShip, prompt.name);
  const [saving, setSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const editableText = splitPromptFile(prompt.text).additions;
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm({
    mode: 'onChange',
    defaultValues: { text: editableText },
  });
  // Rendered from the live form value rather than captured on toggle, so a
  // projection taken in below while previewing replaces what is shown.
  const text = useWatch({ control, name: 'text' });
  const previewState = useMemo(() => {
    if (!isPreviewing) {
      return { content: [], error: null };
    }
    try {
      return {
        content: convertContent(markdownToStory(text), null),
        error: null,
      };
    } catch {
      return {
        content: [],
        error: 'Unable to render this prompt as Markdown.',
      };
    }
  }, [isPreviewing, text]);

  // Take a new projection into the form in place of remounting. Held back
  // while a save is in flight (that state must survive) and while the user
  // has unsaved edits (their draft is theirs to keep) — `changedElsewhere`
  // tells them the stored text moved on in the meantime.
  useEffect(() => {
    if (saving || isDirty) {
      return;
    }
    reset({ text: editableText });
  }, [editableText, isDirty, reset, saving]);

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
    if (!isPreviewing) {
      Keyboard.dismiss();
    }
    setIsPreviewing(!isPreviewing);
  }, [isPreviewing]);

  const handleSave = useCallback(() => {
    if (!isDirty || saving) {
      return;
    }
    handleSubmit(async ({ text }) => {
      // Tlon's blocks come from the projection as it is now, so a refresh
      // that landed while the sheet was open is kept rather than reverted.
      const fileText = joinPromptFile(prompt.text, text);
      // %steward nacks oversized text; check up front for a real error
      // message instead of a failed poke.
      if (promptTextByteLength(fileText) > MAX_PROMPT_BYTES) {
        showToast({
          message: 'Prompt is too long. The limit is 64 KB.',
          duration: 3000,
        });
        return;
      }
      setSaving(true);
      try {
        await savePrompt(fileText);
        onSaved(prompt.name, fileText);
        showToast({
          message: 'Changes saved.',
          duration: 3000,
        });
        setSaving(false);
        // Closes directly rather than through handleOpenChange, whose
        // mid-save guard still sees `saving` as true in this closure.
        Keyboard.dismiss();
        onClose();
      } catch {
        setSaving(false);
        showToast({ message: 'Failed to save prompt.', duration: 3000 });
      }
    })();
  }, [
    handleSubmit,
    isDirty,
    onClose,
    onSaved,
    prompt.name,
    prompt.text,
    savePrompt,
    saving,
    showToast,
  ]);

  const title = promptLabel(prompt.name);
  const editorHeight = isWindowNarrow ? 200 : 280;
  const statusMessage = saving
    ? 'Saving…'
    : changedElsewhere
      ? 'This prompt changed elsewhere. Showing the latest version.'
      : isDirty
        ? 'Unsaved changes'
        : 'Your bot uses these from its next reply.';

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
              title={title}
              meta={prompt.name}
              description="Added to Tlon's defaults and kept when Tlon updates them."
              paddingLeft="$xl"
              paddingRight={isWindowNarrow ? '$xl' : '$4xl'}
            />

            <YStack>
              <XStack
                minHeight="$4xl"
                alignItems="center"
                justifyContent="space-between"
                paddingLeft="$xl"
                gap="$l"
              >
                <Text size="$label/m" color="$tertiaryText">
                  Additions
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
                    accessibilityLabel: `Additions to ${title}`,
                    placeholder: 'Add your own instructions…',
                    multiline: true,
                    minHeight: editorHeight,
                    textAlignVertical: 'top',
                    autoFocus: true,
                    // Save submits the text as it was when pressed; edits
                    // made while it is in flight would be dropped on success.
                    editable: !saving,
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
