import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Icon,
  LoadingSpinner,
  Pressable,
  Text,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, SettingsContentScrollView, TextInput } from '../../ui';
import {
  BotSettingsDivider,
  BotSettingsSection,
  EmptyRowText,
} from './bot/BotSettingsUI';
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
  { title: string; listTitle: string; description: string }
> = {
  dmAllowlist: {
    title: 'DM allowlist',
    listTitle: 'Allowed users',
    description: 'Users on the allowlist can DM Tlonbot directly.',
  },
  defaultAuthorizedShips: {
    title: 'Authorized users',
    listTitle: 'Authorized users',
    description: 'Authorized users can always interact with Tlonbot.',
  },
  groupInviteAllowlist: {
    title: 'Can invite to groups',
    listTitle: 'Invite allowlist',
    description: 'These users can invite Tlonbot to groups.',
  },
};

export function BotShipListSettingsScreen(props: Props) {
  const { list } = props.route.params;
  const meta = shipListMeta[list];
  const isWindowNarrow = useIsWindowNarrow();
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
  const [pendingShip, setPendingShip] = useState('');

  // The desktop settings drawer keeps this screen mounted across list
  // switches; clear the pending input when the list param changes so a ship
  // half-typed for one list can't be committed to another.
  useEffect(() => {
    setPendingShip('');
  }, [list]);

  const value = draft.draft.chat[list];
  const ships = useMemo(() => normalizeShipList(value), [value]);

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const commitShips = useCallback(
    (nextShips: string[]) => {
      const nextValue = formatShipList(nextShips);
      draft.commitDraft((current) => ({
        ...current,
        chat: { ...current.chat, [list]: nextValue },
      }));
    },
    [draft, list]
  );

  const addPendingShip = useCallback(() => {
    if (!ready) return;
    const ship = normalizeShip(pendingShip);
    if (!ship) return;
    if (!ships.includes(ship)) {
      commitShips([...ships, ship]);
    }
    setPendingShip('');
  }, [ready, pendingShip, ships, commitShips]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? handleBack : undefined}
        title={meta.title}
      />
      {!ready ? (
        <View flex={1} alignItems="center" justifyContent="center">
          <LoadingSpinner />
        </View>
      ) : (
        <SettingsContentScrollView
          paddingHorizontal="$l"
          paddingTop="$l"
          safeAreaBottomOffset={24}
        >
          <YStack gap="$2xl" paddingBottom="$2xl">
            <YStack gap="$m">
              <Text
                size="$label/m"
                color="$secondaryText"
                paddingHorizontal="$s"
              >
                Add a user
              </Text>
              <XStack gap="$m" alignItems="center">
                <View flex={1}>
                  <TextInput
                    value={pendingShip}
                    placeholder="~zod, ~nec"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setPendingShip}
                    onSubmitEditing={addPendingShip}
                    returnKeyType="done"
                  />
                </View>
                <Button
                  preset="secondary"
                  label="Add"
                  disabled={!pendingShip.trim()}
                  onPress={addPendingShip}
                />
              </XStack>
              <Text
                size="$label/s"
                color="$secondaryText"
                paddingHorizontal="$s"
              >
                Provide any @p.
              </Text>
            </YStack>

            <BotSettingsSection
              title={meta.listTitle}
              description={meta.description}
            >
              {ships.length === 0 ? (
                <EmptyRowText>No users on this list.</EmptyRowText>
              ) : (
                ships.map((ship, index) => (
                  <YStack key={ship}>
                    <XStack
                      minHeight={56}
                      alignItems="center"
                      gap="$l"
                      paddingHorizontal="$l"
                      paddingVertical="$m"
                    >
                      <Text
                        flex={1}
                        size="$label/l"
                        color="$primaryText"
                        numberOfLines={1}
                      >
                        {ship}
                      </Text>
                      <Pressable
                        onPress={() =>
                          commitShips(ships.filter((entry) => entry !== ship))
                        }
                      >
                        <Icon type="Close" size="$m" color="$secondaryText" />
                      </Pressable>
                    </XStack>
                    {index < ships.length - 1 ? <BotSettingsDivider /> : null}
                  </YStack>
                ))
              )}
            </BotSettingsSection>
          </YStack>
        </SettingsContentScrollView>
      )}
    </View>
  );
}
