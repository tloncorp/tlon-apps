import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useContact, useCurrentUserId, useGroups } from '../contexts';
import { ScrollView, SizableText, Stack, View, XStack } from '../core';
import { useAlphabeticallySegmentedGroups } from '../hooks/groupsSorters';
import { Button } from './Button';
import { FavoriteGroupsDisplay } from './FavoriteGroupsDisplay';
import { GenericHeader } from './GenericHeader';
import { GroupSelectorSheet } from './GroupSelectorSheet';

interface Props {
  onGoBack: () => void;
}

export function EditFavoriteGroupsScreenView(props: Props) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();
  const contact = useContact(currentUserId);

  const groups = useGroups();
  const titledGroups = useMemo(
    () => groups?.filter((g) => !!g.title) ?? [],
    [groups]
  );
  const alphaSegmentedGroups = useAlphabeticallySegmentedGroups(titledGroups);
  const savedFavoriteGroups = useMemo(
    () => contact?.pinnedGroups?.map((pg) => pg.group).filter(Boolean) ?? [],
    [contact]
  );

  // leverage local state for quicker optimistic updates
  const [favoriteGroups, setFavoriteGroups] = useState<db.Group[]>(
    (savedFavoriteGroups as db.Group[]) ?? []
  );

  const handleFavoriteGroupsChange = useCallback(
    (group: db.Group) => {
      const currentFaves = favoriteGroups.map((g) => g.id);
      if (currentFaves.includes(group.id)) {
        setFavoriteGroups(favoriteGroups.filter((g) => g.id !== group.id));
        store.removeCurrentUserPinnedGroup(group.id);
      } else {
        if (currentFaves.length >= 5) {
          // too many!
          return;
        }
        setFavoriteGroups([...favoriteGroups, group]);
        store.addCurrentUserPinnedGroup(group.id);
      }
    },
    [favoriteGroups]
  );

  const SheetTopContent = useMemo(() => {
    return (
      <XStack justifyContent="center">
        <SizableText size="$s" color="$tertiaryText">
          {favoriteGroups.length >= 5
            ? `No more groups can be selected (max 5)`
            : `Choose up to ${5 - favoriteGroups.length} more groups`}
        </SizableText>
      </XStack>
    );
  }, [favoriteGroups]);

  return (
    <View
      flex={1}
      backgroundColor="$secondaryBackground"
      paddingBottom={insets.bottom + 20}
    >
      <GenericHeader goBack={props.onGoBack} />
      <ScrollView padding="$l">
        <FavoriteGroupsDisplay
          groups={favoriteGroups}
          editable
          onRemove={handleFavoriteGroupsChange}
        />
      </ScrollView>
      <Stack flex={1} justifyContent="flex-end">
        <Button
          hero
          marginHorizontal="$2xl"
          onPress={() => setSelectorOpen(true)}
        >
          <Button.Text>Select Groups</Button.Text>
        </Button>
      </Stack>
      <GroupSelectorSheet
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        alphaSegmentedGroups={alphaSegmentedGroups}
        selected={favoriteGroups.map((g) => g.id)}
        onSelect={handleFavoriteGroupsChange}
        TopContent={SheetTopContent}
      />
    </View>
  );
}
