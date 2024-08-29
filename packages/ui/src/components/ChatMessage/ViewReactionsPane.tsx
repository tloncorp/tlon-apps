import * as db from '@tloncorp/shared/dist/db';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View } from 'tamagui';

import { useGroupedReactions } from '../../utils/postUtils';
import { Button } from '../Button';
import ContactName from '../ContactName';
import { getNativeEmoji } from '../Emoji';
import { ListItem } from '../ListItem';
import { Emoji } from '../TrimmedText';

export function ViewReactionsPane({ post }: { post: db.Post }) {
  const insets = useSafeAreaInsets();
  const groupedReactions = useGroupedReactions(post.reactions ?? []);

  const allReactions = useMemo(() => {
    const all: { userId: string; value: string }[] = [];
    Object.entries(groupedReactions).forEach(([_, entries]) => {
      all.push(...entries);
    });
    return all;
  }, [groupedReactions]);

  const tabs = useMemo(() => {
    const emojis = Object.keys(groupedReactions);
    return ['all', ...emojis];
  }, [groupedReactions]);

  const [currentTab, setCurrentTab] = useState('all');
  const tabData = useMemo(() => {
    if (currentTab === 'all') {
      return allReactions;
    }

    return groupedReactions[currentTab];
  }, [currentTab, allReactions, groupedReactions]);

  return (
    <View>
      <ScrollView horizontal>
        {tabs.map((tab) => (
          <Button
            key={tab}
            onPress={() => setCurrentTab(tab)}
            paddingHorizontal="$xl"
            paddingVertical="$l"
            marginHorizontal="$s"
            backgroundColor={
              currentTab === tab ? '$positiveBackground' : 'unset'
            }
          >
            <Button.Text>
              {tab === 'all' ? 'All' : getNativeEmoji(tab)}
            </Button.Text>
          </Button>
        ))}
      </ScrollView>
      <ScrollView paddingTop="$xl">
        {tabData.map((reaction) => (
          <ListItem key={reaction.userId}>
            <View flexGrow={1}>
              <ContactName userId={reaction.userId} showNickname flex={1} />
            </View>
            <View flexShrink={1}>
              <Emoji size="$m">{getNativeEmoji(reaction.value)}</Emoji>
            </View>
          </ListItem>
        ))}
      </ScrollView>
    </View>
  );
}
