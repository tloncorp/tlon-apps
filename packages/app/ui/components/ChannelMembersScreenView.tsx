import * as db from '@tloncorp/shared/db';
import { useMemo } from 'react';

import { useCalm, useContactIndex } from '../contexts/appDataContext';
import { botBadgeLabel } from './BotBadge';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
  contactSettingsRow,
} from './SettingsList';

export function ChannelMembersScreenView({
  channel,
  goBack,
}: {
  channel?: db.Channel;
  goBack: () => void;
}) {
  const contactIndex = useContactIndex();
  const { disableNicknames } = useCalm();

  const sections = useMemo((): SettingsSectionModel[] => {
    const members = channel?.members ?? [];
    return members.length === 0
      ? []
      : [
          {
            key: 'members',
            rows: members.map(({ contactId }) => {
              const contact = contactIndex?.[contactId];
              return {
                ...contactSettingsRow(contactId, contact, disableNicknames),
                // A bot's row says so, in its badge's words.
                value: botBadgeLabel(contactId, contact)?.text,
              };
            }),
          },
        ];
  }, [channel?.members, contactIndex, disableNicknames]);

  return (
    <SettingsListScreenView
      title="Members"
      sections={sections}
      loading={!channel}
      onBackPressed={goBack}
      showsBackOnWideWindows
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
    />
  );
}
