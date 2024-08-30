import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'tamagui';

import { triggerHaptic } from '../../utils';
import { useGroupedReactions } from '../../utils/postUtils';
import { ActionSheet } from '../ActionSheet';
import { getNativeEmoji } from '../Emoji';
import { ToggleGroupInput } from '../Form';
import { ContactListItem } from '../ListItem';
import { Text } from '../TextV2';

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

  return (
    <View flex={1}>
      <ActionSheet.FormBlock paddingBottom={0}>
        <ToggleGroupInput
          value={currentTab}
          onChange={handleTabPress}
          options={tabs}
        />
      </ActionSheet.FormBlock>
      <ActionSheet.ScrollableContent paddingTop="$xl">
        <ActionSheet.FormBlock flex={1}>
          <ActionSheet.ActionGroupContent borderWidth={0}>
            {tabData.map((reaction) => (
              <ContactListItem
                size="$4xl"
                key={reaction.userId}
                contactId={reaction.userId}
                showNickname
                showUserId
                showEndContent
                endContent={
                  <Text size="$emoji/m">{getNativeEmoji(reaction.value)}</Text>
                }
              ></ContactListItem>
            ))}
          </ActionSheet.ActionGroupContent>
        </ActionSheet.FormBlock>
      </ActionSheet.ScrollableContent>
    </View>
  );
}
