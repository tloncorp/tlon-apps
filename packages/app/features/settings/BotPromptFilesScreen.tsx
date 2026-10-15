import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
import { useCallback, useMemo } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { RootStackParamList } from '../../navigation/types';
import {
  type BotSystemPrompt,
  useBotSystemPrompts,
  useDeskSupportsPrompts,
  useStewardPromptsFeed,
} from '../../ui/components/BotSystemPrompts';
import {
  type SettingsRowModel,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';
import {
  promptDescription,
  promptFileAccess,
  promptLabel,
  sortPromptFiles,
} from '../../ui/components/botPromptFiles';

type Props = NativeStackScreenProps<RootStackParamList, 'BotPromptFiles'>;

const NO_PROMPTS: BotSystemPrompt[] = [];

const messageRow = (title: string): SettingsRowModel => ({
  key: 'message',
  title,
  disabled: true,
  accessory: 'none',
});

/**
 * The bot's advanced settings: the prompt files its workspace runs on, read
 * from the projection mirrored into our own ship's %steward. The bot's
 * profile lists the same files.
 */
export function BotPromptFilesScreen(props: Props) {
  const { navigation } = props;
  const currentUserId = useCurrentUserId();
  const botShip = api.getBotUserIdForUser(currentUserId);
  useStewardPromptsFeed(botShip);
  const promptsQuery = useBotSystemPrompts(botShip);
  const deskSupportsPrompts = useDeskSupportsPrompts();

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const unsupported =
    deskSupportsPrompts === false ||
    promptsQuery.error instanceof api.PromptsUnsupportedError ||
    promptsQuery.error instanceof api.DeskUnsupportedError;
  const prompts = unsupported ? NO_PROMPTS : promptsQuery.data;
  const refetch = promptsQuery.refetch;

  const sections = useMemo<SettingsSectionModel[]>(() => {
    if (!prompts) {
      return [
        {
          key: 'prompt-files',
          title: 'Prompt files',
          rows: [
            messageRow("Couldn't load your bot's prompt files."),
            {
              key: 'retry',
              title: 'Try again',
              action: true,
              onPress: () => void refetch(),
            },
          ],
        },
      ];
    }
    if (prompts.length === 0) {
      return [
        {
          key: 'prompt-files',
          title: 'Prompt files',
          rows: [
            messageRow(
              unsupported
                ? "Prompt files aren't available yet."
                : "Your bot hasn't shared its prompt files yet."
            ),
          ],
        },
      ];
    }
    return [
      {
        key: 'prompt-files',
        title: 'Prompt files',
        footer:
          'Tlon keeps these files up to date so your bot keeps working. You can add to some of them.',
        rows: sortPromptFiles(prompts).map((prompt) => {
          const access = promptFileAccess(prompt.name, prompt.text);
          return {
            key: prompt.name,
            title: promptLabel(prompt.name),
            subtitle: promptDescription(prompt.name),
            value:
              access.kind === 'additions'
                ? access.additions
                  ? 'Customized'
                  : undefined
                : 'Read-only',
            onPress: () =>
              navigation.navigate('BotPromptFile', { name: prompt.name }),
            testID: `BotPromptFileRow:${prompt.name}`,
          };
        }),
      },
    ];
  }, [navigation, prompts, refetch, unsupported]);

  return (
    <SettingsListScreenView
      title="Advanced"
      sections={sections}
      onBackPressed={handleBack}
      loading={!unsupported && promptsQuery.isPending}
    />
  );
}
