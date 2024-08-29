import * as db from '@tloncorp/shared/dist/db';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack } from 'tamagui';

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
      <ScrollView
        // flexShrink={1}
        horizontal
        showsHorizontalScrollIndicator={false}
        // contentContainerStyle={{
        //   flexGrow: 1,
        //   justifyContent: 'center',
        // }}
        // borderWidth={3}
        // contentContainerStyle={{
        //   // flexShrink: 1,
        //   justifyContent: 'center',
        //   alignItems: 'center',
        // }}
      >
        {tabs.map((tab, index) => (
          <Button
            flexShrink={1}
            key={tab}
            onPress={() => setCurrentTab(tab)}
            paddingHorizontal="$xl"
            paddingVertical="$m"
            // marginHorizontal="$s"
            borderTopRightRadius={index === tabs.length - 1 ? undefined : 0}
            borderBottomRightRadius={index === tabs.length - 1 ? undefined : 0}
            borderTopLeftRadius={index === 0 ? undefined : 0}
            borderBottomLeftRadius={index === 0 ? undefined : 0}
            borderLeftWidth={index === 0 ? 'unset' : 0}
            backgroundColor={
              currentTab === tab ? '$secondaryBackground' : 'unset'
            }
          >
            {tab === 'all' ? (
              <Button.Text>All</Button.Text>
            ) : (
              <Emoji size="$m">{getNativeEmoji(tab)}</Emoji>
            )}
          </Button>
        ))}
      </ScrollView>
      <ScrollView paddingTop="$xl">
        {tabData.map((reaction) => (
          <ListItem key={reaction.userId} paddingHorizontal={0}>
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
