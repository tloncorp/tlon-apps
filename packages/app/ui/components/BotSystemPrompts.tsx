import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { Button, Text, useToast } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { View, YStack } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { ControlledTextareaField } from './Form';
import { ListItem } from './ListItem';

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
     * True while the first fetch is still deciding. Callers gating a
     * destructive action (e.g. Block) should treat ownership as unknown
     * rather than "not owned" until this settles.
     */
    isPending: promptsQuery.isPending,
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

/**
 * One legible line for the row preview: managed prompt files start with
 * HTML marker comments and markdown headings that read as noise in a
 * single-line preview.
 */
function promptPreview(text: string): string {
  const cleaned = text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Empty';
}

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

  return (
    <View paddingHorizontal="$xl" width="100%">
      <Text
        size="$label/m"
        color="$secondaryText"
        paddingHorizontal="$l"
        marginTop="$l"
        paddingBottom="$m"
      >
        System prompts
      </Text>
      <YStack
        borderRadius="$2xl"
        backgroundColor="$background"
        paddingVertical="$m"
      >
        {prompts.map((prompt) => (
          <Pressable
            key={prompt.name}
            borderRadius="$2xl"
            onPress={() => setEditing(prompt)}
            pressStyle={{ backgroundColor: '$secondaryBackground' }}
          >
            <ListItem
              alignItems="center"
              backgroundColor="$transparent"
              paddingHorizontal="$l"
              paddingVertical="$s"
            >
              <ListItem.SystemIcon icon="Settings" rounded />
              <ListItem.MainContent>
                <ListItem.Title>
                  {PROMPT_LABELS[prompt.name] ?? prompt.name}
                </ListItem.Title>
                <ListItem.Subtitle numberOfLines={1}>
                  {prompt.edited
                    ? `Customized · ${promptPreview(prompt.text)}`
                    : promptPreview(prompt.text)}
                </ListItem.Subtitle>
              </ListItem.MainContent>
              <ListItem.EndContent>
                <ListItem.SystemIcon
                  icon="ChevronRight"
                  backgroundColor="$transparent"
                />
              </ListItem.EndContent>
            </ListItem>
          </Pressable>
        ))}
      </YStack>
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
  const [saving, setSaving] = useState(false);
  const {
    control,
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

  const handleSave = useCallback(() => {
    if (!isDirty || saving) {
      handleOpenChange(false);
      return;
    }
    handleSubmit(async ({ text }) => {
      // %steward nacks oversized text; check up front for a real error
      // message instead of a failed poke.
      if (promptTextByteLength(text) > api.MAX_PROMPT_TEXT_BYTES) {
        showToast({
          message: 'Prompt is too long — the limit is 64KB.',
          duration: 3000,
        });
        return;
      }
      setSaving(true);
      try {
        await api.setBotSystemPrompt({ botShip, name: prompt.name, text });
        onSaved(prompt.name, text);
        showToast({
          message: 'Saved. Tlonbot is restarting to apply it.',
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

  return (
    <ActionSheet open onOpenChange={handleOpenChange} modal>
      <ActionSheet.SimpleHeader
        title={PROMPT_LABELS[prompt.name] ?? prompt.name}
        subtitle={prompt.name}
      />
      <ActionSheet.ScrollableContent>
        <ActionSheet.ContentBlock>
          <YStack gap="$l">
            {PROMPT_DESCRIPTIONS[prompt.name] ? (
              <Text size="$label/m" color="$secondaryText">
                {PROMPT_DESCRIPTIONS[prompt.name]}
              </Text>
            ) : null}
            <ControlledTextareaField
              name="text"
              control={control}
              inputProps={{
                placeholder: 'Write the prompt…',
                multiline: true,
                minHeight: 280,
                textAlignVertical: 'top',
                autoFocus: true,
              }}
            />
            <Button
              preset="primary"
              label={saving ? 'Saving…' : 'Save'}
              disabled={saving}
              onPress={handleSave}
              centered
            />
          </YStack>
        </ActionSheet.ContentBlock>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
