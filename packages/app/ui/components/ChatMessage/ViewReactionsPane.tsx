import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { View } from 'tamagui';

import { triggerHaptic } from '../../utils';
import { useGroupedReactions } from '../../utils/postUtils';
import { ActionSheet } from '../ActionSheet';
import { getNativeEmoji } from '../Emoji';
import { ToggleGroupInput } from '../Form';
import { ContactListItem } from '../ListItem';

export function ViewReactionsPane({
  post,
  setIsScrolling,
}: {
  post: db.Post;
  setIsScrolling?: (isScrolling: boolean) => void;
}) {
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
            <Text size="$emoji/m">{getNativeEmoji(tabVal)}</Text>
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

  const onTouchStart = useCallback(() => {
    setIsScrolling?.(true);
  }, [setIsScrolling]);
  const onTouchEnd = useCallback(
    () => setIsScrolling?.(false),
    [setIsScrolling]
  );

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
            <Text size="$emoji/m">{getNativeEmoji(reaction.value)}</Text>
          }
        ></ContactListItem>
      );
    },
    []
  );

  return (
    <View flex={1}>
      <ActionSheet.FormBlock paddingBottom={0}>
        <ToggleGroupInput
          value={currentTab}
          onChange={handleTabPress}
          options={tabs}
        />
      </ActionSheet.FormBlock>
      <ActionSheet.Content paddingVertical="$xl" flex={1}>
        <ActionSheet.FormBlock flex={1}>
          <ActionSheet.ActionGroupContent borderWidth={0}>
            <FlatList
              data={tabData}
              renderItem={({ item }) => renderItem({ reaction: item })}
              keyExtractor={(item) => item.userId + item.value}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            />
          </ActionSheet.ActionGroupContent>
        </ActionSheet.FormBlock>
      </ActionSheet.Content>
    </View>
  );
}
