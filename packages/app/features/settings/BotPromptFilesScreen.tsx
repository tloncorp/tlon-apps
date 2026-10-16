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
 * from the projection mirrored into our own ship's %steward. Bot settings
 * opens it for the user's hosted bot; a bot's profile opens it for that bot.
 */
export function BotPromptFilesScreen(props: Props) {
  const { navigation } = props;
  const currentUserId = useCurrentUserId();
  const botShip =
    props.route.params?.botShip ?? api.getBotUserIdForUser(currentUserId);
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
              navigation.navigate('BotPromptFile', {
                name: prompt.name,
                botShip,
              }),
            testID: `BotPromptFileRow:${prompt.name}`,
          };
        }),
      },
    ];
  }, [botShip, navigation, prompts, refetch, unsupported]);

  return (
    <SettingsListScreenView
      title="Advanced"
      sections={sections}
      onBackPressed={handleBack}
      // Wide windows open this beside a profile, not under a settings list.
      showsBackOnWideWindows
      maxWidth={600}
      loading={!unsupported && promptsQuery.isPending}
    />
  );
}
