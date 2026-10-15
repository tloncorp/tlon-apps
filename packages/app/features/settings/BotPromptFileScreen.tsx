import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
import { convertContent, markdownToStory } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  Button,
  ConfirmDialog,
  LoadingSpinner,
  Text,
  useIsWindowNarrow,
  useToast,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
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
 */
export function BotPromptFileScreen(props: Props) {
  const { navigation } = props;
  const { name } = props.route.params;
  const { page: settingsPage } = useSettingsListSurfaces();
  const headerColor = useSettingsListHeaderColor();
  const isWindowNarrow = useIsWindowNarrow();
  const showToast = useToast();
  const currentUserId = useCurrentUserId();
  const botShip = api.getBotUserIdForUser(currentUserId);
  useStewardPromptsFeed(botShip);
  const promptsQuery = useBotSystemPrompts(botShip);
  const deskSupportsPrompts = useDeskSupportsPrompts();
  const refreshPrompts = useRefreshStewardPrompts();
  const savePrompt = useStewardPromptSave(botShip, name);
  const warningSeen = db.botPromptEditWarningSeen.useValue();

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

  // The confirmation runs the callback it was opened with, and the file can
  // change while it is up: reset from the file as it is when confirmed.
  const latestPromptRef = useRef(prompt);
  useEffect(() => {
    latestPromptRef.current = prompt;
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

  const handleReset = useCallback(async () => {
    const current = latestPromptRef.current;
    if (!current || resetting) {
      return;
    }
    setResetting(true);
    try {
      await savePrompt(joinPromptFile(current.text, ''));
      refreshPrompts();
      showToast({ message: 'Reset to default.', duration: 3000 });
    } catch {
      showToast({ message: 'Failed to reset prompt.', duration: 3000 });
    }
    setResetting(false);
  }, [refreshPrompts, resetting, savePrompt, showToast]);

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
          title="Your additions"
          description="Tlon's updates never replace your additions."
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
            disabled={resetting}
            onPress={handleEditPressed}
            testID="BotPromptFileEdit"
          />
          {additions ? (
            <Button
              preset="destructive"
              label="Reset to default"
              centered
              disabled={resetting}
              loading={resetting}
              onPress={() => setDialog({ kind: 'reset', bot: botShip, name })}
              testID="BotPromptFileReset"
            />
          ) : null}
        </YStack>
        <BotSettingsSection
          title="Tlon's default"
          description="Tlon keeps this part up to date."
        >
          <PromptText text={managedText} testID="BotPromptFileDefault" />
        </BotSettingsSection>
      </>
    );
  } else {
    body = (
      <BotSettingsSection
        description={
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
        backAction={
          Platform.OS !== 'web' || isWindowNarrow ? handleBack : undefined
        }
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
          scope="additions"
          changedElsewhere={editing.baseAdditions !== access.additions}
          onClose={() => setEditing(null)}
          onSaved={refreshPrompts}
        />
      ) : null}
      <ConfirmDialog
        open={dialog?.kind === 'warning' && isThisFile(dialog)}
        onOpenChange={handleDialogOpenChange}
        title={`Edit ${label}?`}
        description="What you add changes how your bot behaves in every conversation. Tlon's defaults stay, and you can reset at any time."
        confirmText="Continue"
        onConfirm={handleWarningConfirmed}
      />
      <ConfirmDialog
        open={dialog?.kind === 'reset' && isThisFile(dialog)}
        onOpenChange={handleDialogOpenChange}
        destructive
        title="Reset to default?"
        description="This removes everything you added. Tlon's defaults stay."
        confirmText="Reset"
        onConfirm={handleReset}
      />
    </View>
  );
}
