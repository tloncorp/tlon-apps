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
  'BOOT.md': 'Boot',
};

/**
 * System prompt list + editor for an owned bot's profile screen. Reads the
 * prompt set mirrored into our own ship's %steward and edits via the
 * %steward relay — the ship stores the edit durably and the bot's gateway
 * applies it and restarts. Renders nothing when the ship (or the bot's
 * gateway) doesn't support prompt sync yet.
 */
export function BotSystemPromptsSection({ botShip }: { botShip: string }) {
  const queryClient = useQueryClient();
  const promptsQuery = useQuery({
    queryKey: promptsQueryKey(botShip),
    queryFn: () => api.getBotSystemPrompts(botShip),
  });
  const [editing, setEditing] = useState<api.BotSystemPrompt | null>(null);

  // Refresh when the bot's canonical set fans back into our mirror (a seed
  // after gateway restart, or an edit confirmation). staleTime is Infinity
  // repo-wide, so explicit invalidation is the only refresh path. Gated on
  // data presence: this section mounts on every profile view, and most
  // profiles are not our bot — skip the subscription (and its probe scry)
  // unless there are prompts to keep fresh.
  const hasPrompts = Boolean(promptsQuery.data?.length);
  useEffect(() => {
    if (!hasPrompts) {
      return;
    }
    let subscriptionId: number | null = null;
    let cancelled = false;
    api
      .subscribeToBotSystemPrompts((changedBot) => {
        if (changedBot === botShip) {
          queryClient.invalidateQueries({
            queryKey: promptsQueryKey(botShip),
          });
        }
      })
      .then((id) => {
        if (id === null) {
          return;
        }
        if (cancelled) {
          api.unsubscribe(id);
          return;
        }
        subscriptionId = id;
      })
      .catch(() => {
        // No live updates; the scry on mount still shows current state.
      });
    return () => {
      cancelled = true;
      if (subscriptionId !== null) {
        api.unsubscribe(subscriptionId);
      }
    };
  }, [botShip, hasPrompts, queryClient]);

  const handleSaved = useCallback(
    (name: string, text: string) => {
      // The poke was accepted by our ship; reflect it immediately rather
      // than waiting for the bot's sync fact (the gateway restart delays it).
      queryClient.setQueryData(
        promptsQueryKey(botShip),
        (current: api.BotSystemPrompt[] | null | undefined) =>
          current?.map((prompt) =>
            prompt.name === name
              ? { ...prompt, text, updatedAt: Date.now() }
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
        paddingBottom="$m"
      >
        System prompts
      </Text>
      <YStack borderRadius="$2xl" backgroundColor="$background">
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
              <ListItem.MainContent>
                <ListItem.Title>
                  {PROMPT_LABELS[prompt.name] ?? prompt.name}
                </ListItem.Title>
                <ListItem.Subtitle numberOfLines={1}>
                  {prompt.text.trim().replace(/\s+/g, ' ') || 'Empty'}
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
