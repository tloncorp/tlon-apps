import { addPostReaction, removePostReaction } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { MotiView } from 'moti';
import { RefObject, useCallback, useEffect, useState } from 'react';
import { Dimensions, LayoutChangeEvent, View as RNView } from 'react-native';
import Animated, {
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dialog, View, XStack, YStack, ZStack } from '../../core';
import { ActionList } from '../ActionList';
import ChatMessage from '../ChatMessage';
import { SizableEmoji } from '../Emoji/SizableEmoji';
import { Icon } from '../Icon';

interface LayoutStruct {
  x: number;
  y: number;
  height: number;
  width: number;
}

export function ChatMessageActions({
  post,
  postRef,
  onDismiss,
}: {
  post: db.PostWithRelations;
  postRef: RefObject<RNView>;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const PADDING_THRESHOLD = 40;

  const [actionLayout, setActionLayout] = useState<LayoutStruct | null>(null);
  const [originalLayout, setOriginalLayout] = useState<LayoutStruct | null>(
    null
  );
  const translateX = useSharedValue(-500); // Start offscreen to the left
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.3); // Start with a smaller scale
  const opacity = useSharedValue(0);

  function handleLayout(event: LayoutChangeEvent) {
    const { height, width, x, y } = event.nativeEvent.layout;
    setActionLayout({ x, y, height, width });
  }

  function calcVerticalPosition(): number {
    if (actionLayout && originalLayout) {
      const originalCenterY = originalLayout.y + originalLayout.height / 2;
      let newY = originalCenterY - actionLayout.height / 2;

      // Ensure the entire actionLayout is within the safe screen bounds
      if (
        newY + actionLayout.height >
        Dimensions.get('window').height - insets.bottom - PADDING_THRESHOLD
      ) {
        newY =
          Dimensions.get('window').height -
          insets.bottom -
          actionLayout.height -
          PADDING_THRESHOLD; // Adjust down if overflowing
      }
      if (newY < insets.top + PADDING_THRESHOLD) {
        newY = insets.top + PADDING_THRESHOLD; // Adjust up if underflowing
      }

      return newY;
    }

    return 0;
  }

  useEffect(() => {
    postRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      translateX.value = pageX;
      translateY.value = pageY;
      setOriginalLayout({ x: pageX, y: pageY, width, height });
    });
  }, [postRef]);

  useEffect(() => {
    if (actionLayout && originalLayout) {
      console.log(`action layout`, JSON.stringify(actionLayout, null, 2));
      console.log(`original layout`, JSON.stringify(originalLayout, null, 2));

      const verticalPosition = calcVerticalPosition();

      const springConfig = {
        damping: 2000, // Increase damping to reduce springiness
        stiffness: 1500, // Increase stiffness to speed up the animation
        mass: 1, // Adjust mass if necessary (default is 1)
      };
      translateY.value = withDelay(
        200,
        withSpring(verticalPosition, springConfig)
      );
      translateX.value = withDelay(150, withSpring(0, springConfig));
      scale.value = withDelay(200, withSpring(1, springConfig));
      opacity.value = withDelay(200, withSpring(1, springConfig));
    }
  }, [actionLayout, originalLayout]);

  const animatedStyles = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    }),
    [translateX, translateY, scale]
  );

  return (
    <Animated.View style={animatedStyles}>
      <View
        onLayout={handleLayout}
        paddingHorizontal="$xl"
        // borderWidth={2}
        // borderColor="blue"
      >
        <YStack gap="$xs">
          <EmojiToolbar post={post} onDismiss={onDismiss} />
          <MessageContainer post={post} postRef={postRef} />
          <MessageActions />
        </YStack>
      </View>
    </Animated.View>
  );
}

export function EmojiToolbar({
  post,
  onDismiss,
}: {
  post: db.PostWithRelations;
  onDismiss: () => void;
}) {
  const hasSelfReact = post.reactions.reduce(
    (has, react) => has || react.contactId === global?.ship,
    false
  );

  const selfShortcode = post.reactions.reduce((foundValue, react) => {
    return (
      foundValue || (react.contactId === global?.ship ? react.value : null)
    );
  }, null);

  const handlePress = useCallback((shortCode) => {
    hasSelfReact && selfShortcode.includes(shortCode)
      ? removePostReaction(post.channelId, post.id, global.ship)
      : addPostReaction(post.channelId, post.id, shortCode, global.ship);

    setTimeout(() => onDismiss(), 50);
  }, []);

  return (
    <XStack
      padding="$l"
      backgroundColor="$background"
      borderRadius="$l"
      justifyContent="space-between"
      width={256}
    >
      <SizableEmoji
        onPress={() => handlePress('seedling')}
        shortCode="seedling"
        fontSize={32}
      />
      <SizableEmoji
        onPress={() => handlePress('cyclone')}
        shortCode="cyclone"
        fontSize={32}
      />
      <SizableEmoji
        onPress={() => handlePress('hot_pepper')}
        shortCode="hot_pepper"
        fontSize={32}
      />
      <SizableEmoji
        onPress={() => handlePress('jack_o_lantern')}
        shortCode="jack_o_lantern"
        fontSize={32}
      />
      <Icon type="ChevronDown" size="$l" />
    </XStack>
  );
}

function MessageActions() {
  return (
    <ActionList width={220}>
      <ActionList.Action>Reply</ActionList.Action>
      <ActionList.Action>Start thread</ActionList.Action>
      <ActionList.Action actionType="destructive" last>
        Delete message
      </ActionList.Action>
    </ActionList>
  );
}

const MAX_MESSAGE_TO_SCREEN_RATIO = 0.4;
function MessageContainer({
  post,
  postRef,
}: {
  post: db.PostWithRelations;
  postRef: RefObject<RNView>;
}) {
  const screenHeight = Dimensions.get('window').height;
  return (
    <View
      maxHeight={screenHeight * MAX_MESSAGE_TO_SCREEN_RATIO}
      backgroundColor="$background"
      padding="$l"
      borderRadius="$l"
    >
      <ChatMessage post={post} />
    </View>
  );
}

// const MAX_MESSAGE_TO_SCREEN_RATIO = 0.4;
// function MessageContainer({ post }: { post: db.PostWithRelations }) {
//   const [scaleFactor, setScaleFactor] = useState<number | null>(null);
//   const screenHeight = Dimensions.get('window').height;

//   function calculateLayout(event: LayoutChangeEvent) {
//     const { height: messageHeight, width: messageWidth } =
//       event.nativeEvent.layout;

//     const messageToScreenHeightRatio = messageHeight / screenHeight;
//     if (messageToScreenHeightRatio > MAX_MESSAGE_TO_SCREEN_RATIO) {
//       setScaleFactor(MAX_MESSAGE_TO_SCREEN_RATIO / messageToScreenHeightRatio);
//     } else {
//       setScaleFactor(1);
//     }
//   }

//   return (
//     <>
//       <MotiView
//       // animate={{
//       //   opacity: scaleFactor === null ? 0 : 1,
//       //   transform: scaleFactor !== null ? [{ scale: scaleFactor }] : [],
//       // }}
//       >
//         {scaleFactor !== null && scaleFactor < 1 ? (
//           <View
//             height={Math.floor(screenHeight * MAX_MESSAGE_TO_SCREEN_RATIO)}
//             borderWidth={2}
//             borderColor="$orange"
//             overflow="hidden"
//           >
//             <View backgroundColor="$background" padding="$l" borderRadius="$l">
//               <ChatMessage post={post} />
//             </View>
//           </View>
//         ) : (
//           <View backgroundColor="$background" padding="$l" borderRadius="$l">
//             <ChatMessage post={post} />
//           </View>
//         )}
//       </MotiView>

//       <View position="absolute" opacity={0} top={-20000} left={-20000}>
//         <View onLayout={calculateLayout}>
//           <ChatMessage post={post} />
//         </View>
//       </View>
//     </>
//   );
// }
