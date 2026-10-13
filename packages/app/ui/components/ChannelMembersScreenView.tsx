import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import { useMemo } from 'react';

import { useCalm, useContactIndex } from '../contexts/appDataContext';
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
                value: botLabel(contactId, contact),
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

/** What the row says of a bot, where a person's row says nothing. */
function botLabel(contactId: string, contact: db.Contact | null | undefined) {
  if (!domain.isBotContact({ id: contactId, botInfo: contact?.botInfo })) {
    return undefined;
  }
  return domain.botLivenessOf(contact) === 'offline' ? 'Bot · Offline' : 'Bot';
}
