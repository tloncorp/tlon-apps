import {
  type DurableAgentSettings,
  type DurableWorkspaceAgent,
  getDurableClient,
} from '@tloncorp/api/client/durable';
import { Button, Text, useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Switch } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import * as store from '@tloncorp/shared/store';

import { AttachmentProvider } from '../contexts/attachment';
import { ActionSheet } from './ActionSheet';
import AttachmentSheet from './AttachmentSheet';
import { ContactAvatar, ImageAvatar } from './Avatar';
import { useImageInput } from './Form';
import { IconEditor, editorAvatar, imageMenuItems } from './IconEditor';
import { useContactName } from './ContactNameV2';
import { InstructionsSheet } from './WorkspaceInstructionsSheet';

/** A workspace has at most this many agents, as its host allows. */
const AGENT_LIMIT = 5;

type Editing =
  | { kind: 'new' }
  | { kind: 'agent'; agent: DurableWorkspaceAgent };

/**
 * A workspace's agents, which every member manages: the list with an on/off
 * switch each, adding one with a nickname and instructions, editing them
 * and the follow-ups switch, and removing one.
 */
export function WorkspaceAgentsSheet({
  groupId,
  groupTitle,
  onClose,
  onChange,
}: {
  groupId: string;
  groupTitle: string;
  onClose: () => void;
  /** The workspace's agents changed. */
  onChange?: () => void;
}) {
  const durable = getDurableClient();
  const showToast = useToast();
  const [agents, setAgents] = useState<DurableWorkspaceAgent[]>(
    () => durable?.workspaceAgents(groupId) ?? []
  );
  const [editing, setEditing] = useState<Editing | null>(null);
  const canUpload = store.useCanUpload();
  const refresh = useCallback(() => {
    setAgents(durable?.workspaceAgents(groupId) ?? []);
    onChange?.();
  }, [durable, groupId, onChange]);

  const toggle = useCallback(
    async (agent: DurableWorkspaceAgent, enabled: boolean) => {
      if (!durable) return;
      try {
        await durable.updateAgent(groupId, agent.id, { enabled });
        refresh();
      } catch {
        showToast({ message: 'Failed to change the agent.', duration: 3000 });
      }
    },
    [durable, groupId, refresh, showToast]
  );

  if (editing) {
    return (
      <AttachmentProvider
        canUpload={canUpload}
        uploadAsset={store.uploadAvatarAsset}
      >
        <AgentEditor
          groupId={groupId}
          groupTitle={groupTitle}
          agent={editing.kind === 'agent' ? editing.agent : undefined}
          onDone={() => {
            refresh();
            setEditing(null);
          }}
        />
      </AttachmentProvider>
    );
  }

  return (
    <ActionSheet
      open
      onOpenChange={(open: boolean) => !open && onClose()}
      title="Agents"
      modal
      closeButton
      dialogContentProps={{ width: 520, minWidth: 440, maxWidth: 520 }}
    >
      <ActionSheet.ScrollableContent>
        <ActionSheet.FormBlock paddingHorizontal="$2xl" paddingTop="$xl">
          <YStack gap="$xl" testID="WorkspaceAgents">
            <Text size="$label/m" color="$secondaryText">
              {`Agents answer in every channel of ${groupTitle} when someone mentions them, and keep up a conversation they're in. Anyone in the workspace can add, change or remove them.`}
            </Text>
            {agents.length === 0 ? (
              <Text size="$label/m" color="$tertiaryText">
                No agents yet.
              </Text>
            ) : (
              agents.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  onPress={() => setEditing({ kind: 'agent', agent })}
                  onToggle={(enabled) => toggle(agent, enabled)}
                />
              ))
            )}
            <Button
              preset="secondary"
              label="Add agent"
              disabled={agents.length >= AGENT_LIMIT}
              onPress={() => setEditing({ kind: 'new' })}
              centered
              testID="AddWorkspaceAgent"
            />
          </YStack>
        </ActionSheet.FormBlock>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}

function AgentRow({
  agent,
  onPress,
  onToggle,
}: {
  agent: DurableWorkspaceAgent;
  onPress: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <XStack
      alignItems="center"
      gap="$l"
      testID={`WorkspaceAgent-${agent.nickname}`}
    >
      <Pressable
        onPress={onPress}
        style={{ flex: 1 }}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${agent.nickname}`}
      >
        <XStack alignItems="center" gap="$l">
          <ContactAvatar contactId={agent.contactId} size="$3xl" />
          <YStack flex={1} gap="$xs" alignItems="flex-start">
            <Text size="$label/l" color="$primaryText">
              {agent.nickname}
            </Text>
            <Text size="$label/s" color="$tertiaryText">
              {agent.enabled ? 'On' : 'Off'}
              {agent.enabled && !agent.followUps ? ' · mentions only' : ''}
            </Text>
          </YStack>
        </XStack>
      </Pressable>
      <Switch
        value={agent.enabled}
        onValueChange={onToggle}
        accessibilityLabel={`${agent.nickname} on`}
        testID={`WorkspaceAgentEnabled-${agent.nickname}`}
      />
    </XStack>
  );
}

/** Adds an agent, or edits one: nickname, instructions and follow-ups. */
function AgentEditor({
  groupId,
  groupTitle,
  agent,
  onDone,
}: {
  groupId: string;
  groupTitle: string;
  agent?: DurableWorkspaceAgent;
  onDone: () => void;
}) {
  const durable = getDurableClient();
  const showToast = useToast();
  const [settings, setSettings] = useState<DurableAgentSettings | null>(null);
  const [followUps, setFollowUps] = useState(agent?.followUps ?? true);
  // The same avatar editing as for your own profile; a picked image waits
  // in this tab until the agent is saved.
  const [avatarImage, setAvatarImage] = useState<string | undefined>();
  const avatar = useImageInput({
    value: avatarImage,
    onChange: setAvatarImage,
  });
  const avatarPicked = avatarImage?.startsWith('blob:') ?? false;
  useEffect(() => {
    if (!durable || !agent) return;
    durable
      .agentSettings(groupId, agent.id)
      .then(setSettings)
      .catch(() =>
        showToast({ message: 'Failed to load the agent.', duration: 3000 })
      );
  }, [agent, durable, groupId, showToast]);
  const changedBy = useContactName(settings?.promptUpdatedBy ?? '');

  const save = useCallback(
    async ({ text, nickname }: { text: string; nickname?: string }) => {
      if (!durable) throw new Error('No server');
      const picked = avatarPicked ? avatarImage : undefined;
      if (!agent) {
        await durable.createAgent(groupId, nickname ?? '', text, picked);
        return;
      }
      await durable.updateAgent(groupId, agent.id, {
        ...(nickname !== agent.nickname ? { nickname } : {}),
        ...(text !== settings?.prompt ? { prompt: text } : {}),
        ...(picked ? { avatar: picked } : {}),
      });
    },
    [agent, avatarImage, avatarPicked, durable, groupId, settings?.prompt]
  );

  const changeFollowUps = useCallback(
    async (value: boolean) => {
      if (!durable || !agent) return;
      setFollowUps(value);
      try {
        await durable.updateAgent(groupId, agent.id, { followUps: value });
      } catch {
        setFollowUps(!value);
        showToast({ message: 'Failed to change the agent.', duration: 3000 });
      }
    },
    [agent, durable, groupId, showToast]
  );

  const remove = useCallback(() => {
    if (!durable || !agent) return;
    const run = async () => {
      try {
        await durable.removeAgent(groupId, agent.id);
        onDone();
      } catch {
        showToast({ message: 'Failed to remove the agent.', duration: 3000 });
      }
    };
    const message = `${agent.nickname} leaves every channel, and its conversations and scheduled tasks are deleted. Its past messages stay.`;
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${agent.nickname}?\n\n${message}`)) void run();
      return;
    }
    Alert.alert(`Remove ${agent.nickname}?`, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void run() },
    ]);
  }, [agent, durable, groupId, onDone, showToast]);

  if (agent && !settings) return null;
  const changed = settings
    ? `Instructions last changed by ${changedBy || settings.promptUpdatedBy} on ${new Date(settings.promptUpdatedAt).toLocaleDateString()}.`
    : undefined;

  const size = {
    size: 'custom' as const,
    width: editorAvatar.size,
    height: editorAvatar.size,
    borderRadius: editorAvatar.radius,
  };
  // A new agent has no contact yet, so its preview is the picked image or
  // a plain tile until the server makes its generated icon.
  const preview = agent ? (
    <ContactAvatar
      contactId={agent.contactId}
      overrideUrl={avatar.assetUri}
      ignoreCalm
      {...size}
    />
  ) : (
    <ImageAvatar
      imageUrl={avatar.assetUri}
      ignoreCalm
      fallback={
        <View
          width={editorAvatar.size}
          height={editorAvatar.size}
          borderRadius={editorAvatar.radius}
          backgroundColor="$secondaryBackground"
        />
      }
      {...size}
    />
  );
  return (
    <>
      <InstructionsSheet
        header={
          <IconEditor
            avatar={preview}
            isUploading={avatar.isUploading}
            menuItems={imageMenuItems(avatar, 'Remove photo').filter(
              (item) => item.key !== 'remove'
            )}
            onPressFallback={avatar.toggleSheet}
            accessibilityLabel="Change the agent's avatar"
          />
        }
        changed={avatarPicked}
        ready={!avatar.isUploading}
        title={agent ? agent.nickname : 'Add agent'}
        heading="Instructions"
        description={`How this agent behaves in every channel of ${groupTitle}. Anyone in the workspace can read and change them.`}
        storedText={settings?.prompt ?? ''}
        nickname={agent?.nickname ?? ''}
        writable
        idleStatus={changed ?? 'Anyone in this workspace can read these.'}
        placeholder="What is this agent for, and how should it behave?"
        accessibilityLabel="Agent instructions"
        saveLabel={agent ? 'Save changes' : 'Add agent'}
        onSave={save}
        onClose={onDone}
        testID="AgentInstructions"
      >
        {agent ? (
          <YStack gap="$l" paddingLeft="$xl">
            <XStack alignItems="center" justifyContent="space-between" gap="$l">
              <YStack flex={1} gap="$xs">
                <Text size="$label/m" color="$primaryText">
                  Follow-ups
                </Text>
                <Text size="$label/s" color="$secondaryText">
                  Keeps up a conversation it&rsquo;s in without being mentioned
                  again.
                </Text>
              </YStack>
              <Switch
                value={followUps}
                onValueChange={changeFollowUps}
                accessibilityLabel="Follow-ups"
                testID="AgentFollowUps"
              />
            </XStack>
            <Button
              preset="destructive"
              size="small"
              label="Remove agent"
              onPress={remove}
              testID="RemoveWorkspaceAgent"
            />
          </YStack>
        ) : null}
      </InstructionsSheet>
      {/* Web has no menu, so it picks from this sheet. */}
      <AttachmentSheet {...avatar.sheetProps} showClearOption={false} />
    </>
  );
}
