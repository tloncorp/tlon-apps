import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { RootStackParamList } from '../../navigation/types';
import { ShipPickerSheet, useCalm, useContactIndex } from '../../ui';
import {
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';
import { formatUserId } from '../../ui/utils/user';
import {
  formatShipList,
  normalizeShip,
  normalizeShipList,
} from './bot/helpers';
import { useBotSettingsQueries } from './bot/useBotSettingsData';
import {
  useBotSettingsDraft,
  useSyncBotSettingsDraft,
} from './bot/useBotSettingsDraft';

type Props = NativeStackScreenProps<RootStackParamList, 'BotShipListSettings'>;

export type BotShipListKind =
  | 'dmAllowlist'
  | 'defaultAuthorizedShips'
  | 'groupInviteAllowlist';

const shipListMeta: Record<
  BotShipListKind,
  { title: string; listTitle: string; description: string; addSubtitle: string }
> = {
  dmAllowlist: {
    title: 'DM allowlist',
    listTitle: 'Allowed users',
    description: 'Users on the allowlist can DM Tlonbot directly.',
    addSubtitle: 'Select a contact or enter any @p to allow DMs.',
  },
  defaultAuthorizedShips: {
    title: 'Authorized users',
    listTitle: 'Authorized users',
    description: 'Authorized users can always interact with Tlonbot.',
    addSubtitle: 'Select a contact or enter any @p to authorize.',
  },
  groupInviteAllowlist: {
    title: 'Can invite to groups',
    listTitle: 'Invite allowlist',
    description: 'These users can invite Tlonbot to groups.',
    addSubtitle: 'Select a contact or enter any @p to allow group invites.',
  },
};

export function BotShipListSettingsScreen(props: Props) {
  const { list } = props.route.params;
  const meta = shipListMeta[list];
  // Populate the draft from the server before editing. Reaching this leaf
  // directly (cold launch / deep link) would otherwise start from an empty
  // draft, and applying would persist those empty defaults over the real
  // permissions. Gate edits on `initialized`.
  const queries = useBotSettingsQueries();
  useSyncBotSettingsDraft(queries);
  const draft = useBotSettingsDraft();
  // Also require the draft to be scoped to the current ship: after switching
  // accounts the store can still hold the previous ship's (initialized) draft
  // until useSyncBotSettingsDraft replaces it.
  const ready = draft.initialized && draft.scopeKey === queries.ship;
  const [pickerOpen, setPickerOpen] = useState(false);

  // The desktop settings drawer keeps this screen mounted across list switches;
  // close the picker when the list param changes so it can't add to the wrong
  // list, and when the scope goes unready (e.g. account switch) so a picker
  // opened in the previous scope doesn't reopen and edit the new one once it
  // syncs.
  useEffect(() => {
    setPickerOpen(false);
  }, [list, ready]);

  const value = draft.draft.chat[list];
  const ships = useMemo(() => normalizeShipList(value), [value]);

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  // Compute the next list from the CURRENT draft inside the updater, not a
  // captured render value, so two quick edits (e.g. removing two ships before a
  // re-render) don't each start from the same stale list and clobber each other.
  const updateShips = useCallback(
    (transform: (currentShips: string[]) => string[]) => {
      draft.commitDraft((current) => ({
        ...current,
        chat: {
          ...current.chat,
          [list]: formatShipList(
            transform(normalizeShipList(current.chat[list]))
          ),
        },
      }));
    },
    [draft, list]
  );

  const handleSelectShip = useCallback(
    (shipId: string) => {
      // Guard against a selection landing after the draft scope changed
      // (e.g. account switch) — writing then would be from the wrong scope.
      if (!ready) {
        setPickerOpen(false);
        return;
      }
      const ship = normalizeShip(shipId);
      if (ship) {
        updateShips((current) =>
          current.includes(ship) ? current : [...current, ship]
        );
      }
      setPickerOpen(false);
    },
    [ready, updateShips]
  );

  const removeShip = useCallback(
    (ship: string) => {
      updateShips((current) => current.filter((entry) => entry !== ship));
    },
    [updateShips]
  );

  const contactIndex = useContactIndex();
  const { disableNicknames } = useCalm();
  const sections = useMemo<SettingsSectionModel[]>(
    () => [
      {
        key: list,
        footer: meta.description,
        rows:
          ships.length === 0
            ? [{ key: 'empty', title: 'No users on this list.' }]
            : ships.map((ship) => {
                const userId = formatUserId(ship)?.display ?? ship;
                const nickname = disableNicknames
                  ? null
                  : contactIndex?.[ship]?.nickname;
                return {
                  key: ship,
                  title: nickname || userId,
                  subtitle: nickname ? userId : undefined,
                  leading: { kind: 'contact', contactId: ship },
                  value: 'Remove',
                  // Removing only edits the draft, which the apply bar commits.
                  accessory: 'none',
                  onPress: () => removeShip(ship),
                };
              }),
      },
    ],
    [contactIndex, disableNicknames, list, meta.description, removeShip, ships]
  );

  return (
    <SettingsListScreenView
      title={meta.title}
      sections={sections}
      onBackPressed={handleBack}
      loading={!ready}
      rightActions={[
        {
          id: 'add-ship',
          icon: 'Add',
          label: `Add ${meta.title.toLowerCase()}`,
          onPress: () => setPickerOpen(true),
          visible: ready,
        },
      ]}
    >
      <ShipPickerSheet
        open={ready && pickerOpen}
        onOpenChange={setPickerOpen}
        subtitle={meta.addSubtitle}
        disabledIds={ships}
        onSelect={handleSelectShip}
      />
    </SettingsListScreenView>
  );
}
