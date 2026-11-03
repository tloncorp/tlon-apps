import * as db from '@tloncorp/shared/db';
import { useMemo, useState } from 'react';

import { useCalm, useContactIndex } from '../contexts/appDataContext';
import { botBadgeLabel } from './BotBadge';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
  SettingsListScreenView,
  contactSettingsRow,
} from './SettingsList';

const pageSize = 100;

export function ChannelMembersScreenView({
  channel,
  goBack,
}: {
  channel?: db.Channel;
  goBack: () => void;
}) {
  const contactIndex = useContactIndex();
  const { disableNicknames } = useCalm();
  // The native lists draw every row they are given, so a big channel is
  // shown a page at a time, as the workspace's members are.
  const [limit, setLimit] = useState(pageSize);

  const sections = useMemo((): SettingsSectionModel[] => {
    const members = channel?.members ?? [];
    if (members.length === 0) {
      return [];
    }
    const hidden = members.length - limit;
    return [
      {
        key: 'members',
        rows: members.slice(0, limit).map(({ contactId }) => {
          const contact = contactIndex?.[contactId];
          return {
            ...contactSettingsRow(contactId, contact, disableNicknames),
            // A bot's row says so, in its badge's words.
            value: botBadgeLabel(contactId, contact)?.text,
          };
        }),
      },
      ...(hidden > 0
        ? [
            {
              key: 'more',
              rows: [
                {
                  key: 'more',
                  title: `Show ${Math.min(hidden, pageSize)} more`,
                  action: true,
                  onPress: () => setLimit((current) => current + pageSize),
                  testID: 'ShowMoreMembers',
                },
              ],
            },
          ]
        : []),
    ];
  }, [channel?.members, contactIndex, disableNicknames, limit]);

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
