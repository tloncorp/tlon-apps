import * as db from '@tloncorp/shared/dist/db';
import { useState } from 'react';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Input } from 'tamagui';

import { Text, View, YStack } from '../core';
import { Icon } from './Icon';
import { MessageInput } from './MessageInput';
import { MessageInputProps } from './MessageInput/MessageInputBase';

export function BigInput({
  channelType,
  channelId,
  groupMembers,
  shouldBlur,
  setShouldBlur,
  send,
  storeDraft,
  clearDraft,
  getDraft,
  editingPost,
  setEditingPost,
  editPost,
  setShowBigInput,
  placeholder,
}: {
  channelType: db.ChannelType;
} & MessageInputProps) {
  const [title, setTitle] = useState('');
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const imageOpacityStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 100], [1, 0], 'clamp');
    return { opacity };
  });

  return (
    <YStack height="100%" width="100%">
      {channelType === 'notebook' && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '10%',
              zIndex: 10,
            },
            imageOpacityStyle,
          ]}
        >
          <YStack
            backgroundColor="$primaryText"
            width="100%"
            height="100%"
            borderBottomLeftRadius="$xl"
            borderBottomRightRadius="$xl"
            padding="$2xl"
            alignItems="center"
            justifyContent="center"
            gap="$l"
          >
            <Icon type="Camera" size="$l" color="$background" />
            <Text color="$background">Choose an optional cover image</Text>
          </YStack>
        </Animated.View>
      )}
      <Animated.ScrollView
        style={{ height: '100%' }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: channelType === 'notebook' ? '10%' : '0%',
        }}
      >
        {channelType === 'notebook' && (
          <View backgroundColor="$background" width="100%">
            <Input
              size="$xl"
              height="$4xl"
              backgroundColor="$background"
              borderColor="transparent"
              placeholder="New Title"
              onChangeText={setTitle}
            />
          </View>
        )}
        <MessageInput
          shouldBlur={shouldBlur}
          setShouldBlur={setShouldBlur}
          send={send}
          title={title}
          channelId={channelId}
          groupMembers={groupMembers}
          storeDraft={storeDraft}
          clearDraft={clearDraft}
          getDraft={getDraft}
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          editPost={editPost}
          setShowBigInput={setShowBigInput}
          floatingActionButton
          showAttachmentButton={false}
          backgroundColor="$background"
          paddingHorizontal="$m"
          placeholder={placeholder}
          bigInput
        />
      </Animated.ScrollView>
    </YStack>
  );
}
