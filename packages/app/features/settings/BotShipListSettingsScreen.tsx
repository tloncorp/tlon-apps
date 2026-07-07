import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LoadingSpinner, Text, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { View, YStack } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import {
  ActionSheet,
  ContactBook,
  ContactList,
  ScreenHeader,
  SettingsContentScrollView,
} from '../../ui';
import { Badge } from '../../ui/components/Badge';
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

// A ship picker sheet mirroring the DM contact picker: a searchable ContactBook
// that also accepts any typed @p (ContactBook synthesizes a fallback contact
// for a valid patp). Bottom sheet on narrow, dialog on wide, like CreateChat.
function ShipPickerSheet({
  open,
  onOpenChange,
  subtitle,
  disabledIds,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtitle: string;
  disabledIds: string[];
  onSelect: (shipId: string) => void;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const [scrolling, setScrolling] = useState(false);
  // Let the drag handle (not the list) own the pan gesture on Android so the
  // nested ContactBook can scroll.
  const enableContentPanningGesture = useMemo(
    () => (Platform.OS === 'android' ? false : undefined),
    []
  );

  const body = (
    <YStack flex={1} gap="$l" $sm={{ paddingHorizontal: '$xl' }}>
      <ActionSheet.SimpleHeader title="Add a user" subtitle={subtitle} />
      <ContactBook
        searchable
        autoFocus={!isWindowNarrow}
        searchPlaceholder="Filter by nickname or @p"
        onSelect={onSelect}
        onScrollChange={setScrolling}
        disabledIds={disabledIds}
        disabledReason="Already on this list"
        maxHeight={isWindowNarrow ? undefined : 500}
      />
    </YStack>
  );

  if (isWindowNarrow) {
    return (
      <ActionSheet
        open={open}
        onOpenChange={onOpenChange}
        moveOnKeyboardChange
        snapPoints={[90]}
        snapPointsMode="percent"
        disableDrag={scrolling}
        enableContentPanningGesture={enableContentPanningGesture}
        hasScrollableContent
      >
        {body}
      </ActionSheet>
    );
  }

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      mode="dialog"
      closeButton
      dialogContentProps={{ height: 'auto', maxHeight: 1200, width: 600 }}
    >
      <View flex={1} padding="$m">
        {body}
      </View>
    </ActionSheet>
  );
}

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
  const [pickerOpen, setPickerOpen] = useState(false);

  // The desktop settings drawer keeps this screen mounted across list switches;
  // close the picker when the list param changes so it can't add to the wrong
  // list.
  useEffect(() => {
    setPickerOpen(false);
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

  const handleSelectShip = useCallback(
    (shipId: string) => {
      const ship = normalizeShip(shipId);
      if (ship && !ships.includes(ship)) {
        commitShips([...ships, ship]);
      }
      setPickerOpen(false);
    },
    [ships, commitShips]
  );

  const removeShip = useCallback(
    (ship: string) => {
      commitShips(ships.filter((entry) => entry !== ship));
    },
    [ships, commitShips]
  );

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? handleBack : undefined}
        title={meta.title}
        rightControls={
          ready ? (
            <ScreenHeader.IconButton
              type="Add"
              onPress={() => setPickerOpen(true)}
            />
          ) : undefined
        }
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
          <YStack gap="$l" paddingBottom="$2xl">
            <Text size="$label/m" color="$secondaryText" paddingHorizontal="$s">
              {meta.description}
            </Text>
            {ships.length === 0 ? (
              <View alignItems="center" paddingTop="$xl">
                <Text color="$secondaryText">No users on this list.</Text>
              </View>
            ) : (
              <ContactList borderWidth={0}>
                {ships.map((ship) => (
                  <ContactList.Item
                    key={ship}
                    contactId={ship}
                    showNickname
                    showUserId
                    showEndContent
                    endContent={<Badge text="Remove" type="neutral" />}
                    onPress={() => removeShip(ship)}
                  />
                ))}
              </ContactList>
            )}
          </YStack>
        </SettingsContentScrollView>
      )}
      <ShipPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        subtitle={meta.addSubtitle}
        disabledIds={ships}
        onSelect={handleSelectShip}
      />
    </View>
  );
}
