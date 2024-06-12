import * as db from '@tloncorp/shared/dist/db';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SizableText, View, XStack } from '../../core';
import Pressable from '../Pressable';

export type ActivityTab = 'all' | 'threads' | 'mentions';

function ActivityHeaderRaw({
  activeTab,
  onTabPress,
}: {
  activeTab: db.ActivityBucket;
  onTabPress: (tab: db.ActivityBucket) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View paddingTop={insets.top}>
      <XStack justifyContent="center" paddingVertical="$m">
        <SizableText size="$l" fontWeight="500">
          Activity
        </SizableText>
      </XStack>
      <XStack>
        <XStack
          flexGrow={1}
          borderBottomWidth={activeTab === 'all' ? 1 : 0}
          borderColor="$primaryText"
          justifyContent="center"
        >
          <Pressable
            disabled={activeTab === 'all'}
            onPress={() => onTabPress('all')}
          >
            <SizableText
              width={100}
              textAlign="center"
              paddingVertical="$m"
              color={activeTab === 'all' ? '$primaryText' : '$secondaryText'}
            >
              All
            </SizableText>
          </Pressable>
        </XStack>
        <XStack
          flexGrow={1}
          borderBottomWidth={activeTab === 'mentions' ? 1 : 0}
          borderColor="$primaryText"
          justifyContent="center"
        >
          <Pressable
            disabled={activeTab === 'mentions'}
            onPress={() => onTabPress('mentions')}
          >
            <SizableText
              width={100}
              textAlign="center"
              paddingVertical="$m"
              color={
                activeTab === 'mentions' ? '$primaryText' : '$secondaryText'
              }
            >
              Mentions
            </SizableText>
          </Pressable>
        </XStack>
        <XStack
          flexGrow={1}
          borderBottomWidth={activeTab === 'replies' ? 1 : 0}
          borderColor="$primaryText"
          justifyContent="center"
        >
          <Pressable
            disabled={activeTab === 'replies'}
            onPress={() => onTabPress('replies')}
          >
            <SizableText
              width={100}
              textAlign="center"
              paddingVertical="$m"
              color={
                activeTab === 'replies' ? '$primaryText' : '$secondaryText'
              }
            >
              Replies
            </SizableText>
          </Pressable>
        </XStack>
      </XStack>
    </View>
  );
}
export const ActivityHeader = React.memo(ActivityHeaderRaw);
