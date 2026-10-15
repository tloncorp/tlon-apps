import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';
import { convertContent, markdownToStory } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  Button,
  ConfirmDialog,
  LoadingSpinner,
  Text,
  useToast,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, YStack } from 'tamagui';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, SettingsContentScrollView } from '../../ui';
import {
  BotSystemPromptEditorSheet,
  useBotSystemPrompts,
  useDeskSupportsPrompts,
  useRefreshStewardPrompts,
  useStewardPromptSave,
  useStewardPromptsFeed,
} from '../../ui/components/BotSystemPrompts';
import { NotebookContentRenderer } from '../../ui/components/NotebookPost/NotebookPost';
import {
  useSettingsListHeaderColor,
  useSettingsListSurfaces,
} from '../../ui/components/SettingsList';
import {
  joinPromptFile,
  promptDescription,
  promptDisplayText,
  promptFileAccess,
  promptLabel,
  splitPromptFile,
} from '../../ui/components/botPromptFiles';
import { BotSettingsSection } from './bot/BotSettingsUI';
import {
  isHostedBotOfCurrentUser,
  restartHostedBot,
  useHostedBotRestarting,
} from './bot/restartHostedBot';

type Props = NativeStackScreenProps<RootStackParamList, 'BotPromptFile'>;

/** Markdown as the notebook renders it, or the raw text if it won't parse. */
function PromptText({ text, testID }: { text: string; testID?: string }) {
  const content = useMemo(() => {
    try {
      return convertContent(markdownToStory(text), null);
    } catch {
      return null;
    }
  }, [text]);
  return (
    <YStack paddingHorizontal="$l" paddingVertical="$m" testID={testID}>
      {content ? (
        <NotebookContentRenderer content={content} marginHorizontal="$-l" />
      ) : (
        <Text size="$body" color="$primaryText">
          {text}
        </Text>
      )}
    </YStack>
  );
}

/**
 * One prompt file from the bot's workspace. Files Tlon has to keep updating
 * are read-only; for the rest, the owner edits only what sits outside Tlon's
 * managed blocks, since the prompt sync replaces those on every restart.
 *
 * A save reaches the workspace through %steward, but the gateway reads its
 * prompt files when it starts, so the hosted bot is restarted afterwards the
 * way applying bot settings restarts it.
 */
export function BotPromptFileScreen(props: Props) {
  const { navigation } = props;
  const { name } = props.route.params;
  const { page: settingsPage } = useSettingsListSurfaces();
  const headerColor = useSettingsListHeaderColor();
  const showToast = useToast();
  const currentUserId = useCurrentUserId();
  const botShip =
    props.route.params.botShip ?? api.getBotUserIdForUser(currentUserId);
  useStewardPromptsFeed(botShip);
  const promptsQuery = useBotSystemPrompts(botShip);
  const deskSupportsPrompts = useDeskSupportsPrompts();
  const refreshPrompts = useRefreshStewardPrompts();
  const savePrompt = useStewardPromptSave(botShip, name);
  const warningSeen = db.botPromptEditWarningSeen.useValue();
  const queryClient = useQueryClient();
  const restartsBot = isHostedBotOfCurrentUser(botShip, currentUserId);
  // Hosting addresses the bot by its owner's ship.
  const hostedShip = desig(currentUserId);
  const restarting = useHostedBotRestarting(restartsBot ? hostedShip : null);

  // Both name the file they were opened for: the desktop settings drawer
  // keeps this screen mounted when another file is opened, and nothing begun
  // on one file may carry over to the next. Editing also holds the additions
  // it started from, so the sheet can say when the file changed underneath
  // it; the sheet itself reads the live file.
  const [editing, setEditing] = useState<{
    bot: string;
    name: string;
    baseAdditions: string;
  } | null>(null);
  const [dialog, setDialog] = useState<{
    kind: 'warning' | 'reset';
    bot: string;
    name: string;
  } | null>(null);
  const [resetting, setResetting] = useState(false);
  const isThisFile = (target: { bot: string; name: string } | null) =>
    target?.bot === botShip && target.name === name;

  const prompt =
    deskSupportsPrompts === false
      ? undefined
      : promptsQuery.data?.find((file) => file.name === name);
  const access = prompt ? promptFileAccess(prompt.name, prompt.text) : null;
  const additions = access?.kind === 'additions' ? access.additions : null;

  // The native confirmation runs the callback it was opened with, while the
  // file, and even which file this screen shows, can change while it is up:
  // reset from the file as it is when confirmed, and only the file it was
  // opened for.
  const latestRef = useRef({ bot: botShip, prompt });
  useEffect(() => {
    latestRef.current = { bot: botShip, prompt };
  });

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const beginEditing = useCallback(() => {
    if (additions === null) {
      return;
    }
    setEditing({ bot: botShip, name, baseAdditions: additions });
  }, [additions, botShip, name]);

  const handleEditPressed = useCallback(() => {
    if (warningSeen) {
      beginEditing();
    } else {
      setDialog({ kind: 'warning', bot: botShip, name });
    }
  }, [beginEditing, botShip, name, warningSeen]);

  const handleWarningConfirmed = useCallback(() => {
    void db.botPromptEditWarningSeen.setValue(true);
    beginEditing();
  }, [beginEditing]);

  const restartBot = useCallback(async () => {
    if (!restartsBot) {
      return;
    }
    // The bot card's status badge reads readiness, and nothing refetches a
    // cached `true` on its own. Mark the bot not ready for the outage, which
    // also starts bot settings' own polling until it is back, then refresh
    // once more when the restart settles.
    const readyKey = ['tlonbot', 'ready', hostedShip];
    queryClient.setQueryData(readyKey, false);
    const message = await restartHostedBot(hostedShip).then(
      (confirmed) =>
        confirmed
          ? 'Your bot restarted with the change.'
          : "Saved, but couldn't confirm your bot restarted. It picks up the change once it does.",
      () =>
        "Saved, but your bot couldn't restart. It picks up the change the next time it does."
    );
    queryClient.invalidateQueries({ queryKey: readyKey });
    showToast({ message, duration: 3000 });
  }, [hostedShip, queryClient, restartsBot, showToast]);

  const handleSaved = useCallback(() => {
    refreshPrompts();
    void restartBot();
  }, [refreshPrompts, restartBot]);

  const handleReset = useCallback(async () => {
    const { bot: currentBot, prompt: current } = latestRef.current;
    // A file that lost Tlon's blocks while the confirmation was up would
    // reset to nothing at all.
    if (
      !current ||
      currentBot !== botShip ||
      current.name !== name ||
      resetting ||
      promptFileAccess(current.name, current.text).kind !== 'additions'
    ) {
      return;
    }
    setResetting(true);
    try {
      await savePrompt(joinPromptFile(current.text, ''));
      refreshPrompts();
      showToast({ message: 'Reset to default.', duration: 3000 });
      void restartBot();
    } catch {
      showToast({ message: 'Failed to reset prompt.', duration: 3000 });
    }
    setResetting(false);
  }, [
    botShip,
    name,
    refreshPrompts,
    resetting,
    restartBot,
    savePrompt,
    showToast,
  ]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDialog(null);
    }
  }, []);

  const label = promptLabel(name);
  const managedText = prompt
    ? promptDisplayText(splitPromptFile(prompt.text).managedBlocks.join('\n'))
    : '';

  let body;
  if (!prompt) {
    body =
      promptsQuery.isPending && deskSupportsPrompts !== false ? (
        <View paddingVertical="$2xl" alignItems="center">
          <LoadingSpinner />
        </View>
      ) : (
        <Text size="$label/m" color="$secondaryText" paddingHorizontal="$s">
          {"This prompt file isn't available."}
        </Text>
      );
  } else if (access?.kind === 'additions') {
    body = (
      <>
        <BotSettingsSection
          title="Additions"
          subtitle="Kept when Tlon updates the defaults."
        >
          {additions ? (
            <PromptText text={additions} testID="BotPromptFileAdditions" />
          ) : (
            <Text
              size="$body"
              color="$tertiaryText"
              paddingHorizontal="$l"
              paddingVertical="$l"
            >
              Nothing added yet.
            </Text>
          )}
        </BotSettingsSection>
        <YStack gap="$m">
          <Button
            preset="primary"
            label={additions ? 'Edit additions' : 'Add instructions'}
            centered
            disabled={resetting || restarting}
            onPress={handleEditPressed}
            testID="BotPromptFileEdit"
          />
          {additions ? (
            <Button
              preset="destructive"
              label="Reset to default"
              centered
              disabled={resetting || restarting}
              loading={resetting}
              onPress={() => setDialog({ kind: 'reset', bot: botShip, name })}
              testID="BotPromptFileReset"
            />
          ) : null}
          {restarting ? (
            <Text
              size="$label/s"
              color="$secondaryText"
              paddingHorizontal="$s"
              accessibilityLiveRegion="polite"
              testID="BotPromptFileRestarting"
            >
              Restarting your bot so it picks this up…
            </Text>
          ) : null}
        </YStack>
        <BotSettingsSection
          title="Tlon's default"
          subtitle="Tlon keeps this part up to date."
        >
          <PromptText text={managedText} testID="BotPromptFileDefault" />
        </BotSettingsSection>
      </>
    );
  } else {
    body = (
      <BotSettingsSection
        subtitle={
          access?.kind === 'unmanaged'
            ? "This file is missing Tlon's defaults, so you can't edit it here. They come back the next time your bot restarts."
            : 'Read-only. Tlon keeps this file up to date so your bot keeps working.'
        }
      >
        <PromptText
          text={promptDisplayText(prompt.text)}
          testID="BotPromptFileContents"
        />
      </BotSettingsSection>
    );
  }

  return (
    <View flex={1} backgroundColor={settingsPage}>
      <ScreenHeader
        backgroundColor={headerColor}
        borderBottom
        backAction={handleBack}
        title={label}
        placement="navigation"
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
      >
        <YStack gap="$2xl" paddingBottom="$2xl">
          <YStack gap="$xs" paddingHorizontal="$s">
            <Text size="$label/m" color="$secondaryText">
              {promptDescription(name)}
            </Text>
            <Text size="$label/s" color="$tertiaryText">
              {name}
            </Text>
          </YStack>
          {body}
        </YStack>
      </SettingsContentScrollView>
      {editing &&
      isThisFile(editing) &&
      prompt &&
      access?.kind === 'additions' ? (
        <BotSystemPromptEditorSheet
          key={`${botShip}/${prompt.name}`}
          botShip={botShip}
          prompt={prompt}
          changedElsewhere={editing.baseAdditions !== access.additions}
          restartsBotOnSave={restartsBot}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}
      <ConfirmDialog
        open={dialog?.kind === 'warning' && isThisFile(dialog)}
        onOpenChange={handleDialogOpenChange}
        title={`Edit ${label}?`}
        description={`What you add changes how your bot behaves in every conversation.${
          restartsBot ? ' Saving restarts your bot briefly.' : ''
        } Tlon's defaults stay, and you can reset at any time.`}
        confirmText="Continue"
        onConfirm={handleWarningConfirmed}
      />
      <ConfirmDialog
        open={dialog?.kind === 'reset' && isThisFile(dialog)}
        onOpenChange={handleDialogOpenChange}
        destructive
        title="Reset to default?"
        description={`This removes all additions, including any your bot made. Tlon's defaults stay.${
          restartsBot ? ' Your bot restarts briefly.' : ''
        }`}
        confirmText="Reset"
        onConfirm={handleReset}
      />
    </View>
  );
}
