import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';

import { SizableText, View, XStack, YStack } from '../../core';
import ContactName from '../ContactName';
import { ListItem, ListItemProps } from '../ListItem';
import { LoadingSpinner } from '../LoadingSpinner';

interface State {
  loading: boolean;
  error: string | null;
  groups: db.Group[];
}

export function ViewUserGroupsWidget({
  userId,
  onSelectGroup,
}: {
  userId: string;
  onSelectGroup: (group: db.Group) => void;
}) {
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    groups: [],
  });

  useEffect(() => {
    const fetchContactGroups = async () => {
      try {
        const groups = await store.getGroupsHostedBy(userId);
        setState({ loading: false, error: null, groups });
      } catch (e) {
        console.error(`Error loading groups hosted by ${userId}`, e);
        setState({ loading: false, error: e.message, groups: [] });
      }
    };
    fetchContactGroups();
  }, [userId]);

  return (
    <View flex={1}>
      {state.loading ? (
        <YStack marginTop="$xl" justifyContent="center" alignItems="center">
          <LoadingSpinner />
          <SizableText marginTop="$xl" color="$secondaryText">
            Loading groups hosted by{' '}
            <ContactName showNickname fontWeight="500" userId={userId} />
          </SizableText>
        </YStack>
      ) : state.error ? (
        <YStack marginTop="$xl" justifyContent="center" alignItems="center">
          <SizableText color="$negativeActionText">
            Error loading groups hosted by{' '}
            <ContactName
              color="$negativeActionText"
              showNickname
              fontWeight="500"
              userId={userId}
            />
          </SizableText>
        </YStack>
      ) : (
        <>
          <XStack justifyContent="center" marginBottom="$xl">
            <SizableText>
              Groups hosted by{' '}
              <ContactName showNickname fontWeight="500" userId={userId} />
            </SizableText>
          </XStack>
          <ScrollView>
            {state.groups.map((group) => (
              <GroupPreviewListItem
                key={group.id}
                model={group}
                onPress={() => onSelectGroup(group)}
              />
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function GroupPreviewListItem({ model, onPress }: ListItemProps<db.Group>) {
  return (
    <ListItem onPress={() => onPress?.(model)}>
      <ListItem.Icon
        fallbackText={model.title?.[0]}
        backgroundColor={model.iconImageColor ?? undefined}
        imageUrl={model.iconImage ?? undefined}
      />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
      </ListItem.MainContent>
    </ListItem>
  );
}
