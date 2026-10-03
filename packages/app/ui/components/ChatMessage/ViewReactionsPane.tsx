import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { View, getTokenValue } from 'tamagui';

import { triggerHaptic } from '../../utils';
import { useGroupedReactions } from '../../utils/postUtils';
import { ActionSheet } from '../ActionSheet';
import { getNativeEmoji } from '../Emoji';
import { ToggleGroupInput } from '../Form';
import { ContactListItem } from '../listItems';

export function ViewReactionsPane({ post }: { post: db.Post }) {
  const groupedReactions = useGroupedReactions(post.reactions ?? []);

  const allReactions = useMemo(() => {
    const all: { userId: string; value: string }[] = [];
    Object.entries(groupedReactions).forEach(([_, entries]) => {
      all.push(...entries);
    });
    return all;
  }, [groupedReactions]);

  const tabs = useMemo(() => {
    const tabValues = ['all', ...Object.keys(groupedReactions)];
    return tabValues.map((tabVal) => {
      return {
        value: tabVal,
        label:
          tabVal === 'all' ? (
            'All'
          ) : (
            <Text size="$emoji/m">{getNativeEmoji(tabVal) || '❓'}</Text>
          ),
      };
    });
  }, [groupedReactions]);

  const [currentTab, setCurrentTab] = useState('all');
  const tabData = useMemo(() => {
    if (currentTab === 'all') {
      return allReactions;
    }
    return groupedReactions[currentTab];
  }, [currentTab, allReactions, groupedReactions]);

  const handleTabPress = useCallback((newTab: string) => {
    triggerHaptic('baseButtonClick');
    setCurrentTab(newTab);
  }, []);

  const renderItem = useCallback(
    ({ reaction }: { reaction: { value: string; userId: string } }) => {
      return (
        <ContactListItem
          size="$4xl"
          contactId={reaction.userId}
          showNickname
          showUserId
          showEndContent
          endContent={
            <Text size="$emoji/m">
              {getNativeEmoji(reaction.value) || '❓'}
            </Text>
          }
        ></ContactListItem>
      );
    },
    []
  );

  return (
    <ActionSheet.Content flex={1}>
      <View paddingHorizontal="$xl" paddingTop="$xl">
        <ToggleGroupInput
          value={currentTab}
          onChange={handleTabPress}
          options={tabs}
        />
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: getTokenValue('$xl', 'space'),
        }}
        data={tabData}
        renderItem={({ item }) => renderItem({ reaction: item })}
        keyExtractor={(item) => item.userId + item.value}
        nestedScrollEnabled
      />
    </ActionSheet.Content>
  );
}
