import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';
import {
  ComponentProps,
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, TouchableOpacity } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { ColorTokens, Stack } from 'tamagui';

import { XStack } from '../core';
import * as utils from '../utils';
import { Icon, IconType } from './Icon';

export function SwipableChatRow(
  props: PropsWithChildren<{ model: db.Channel; jailBroken?: boolean }>
) {
  const swipeableRef = useRef<Swipeable | null>(null);
  const isMuted = store.useChannelIsMuted(props.model);
  // prevent color flicker when unmuting
  const [mutedState, setMutedState] = useState(isMuted);
  useEffect(() => {
    if (mutedState === false && isMuted === true) {
      setTimeout(() => setMutedState(isMuted), 500);
    } else {
      setMutedState(isMuted);
    }
  }, [isMuted, mutedState]);

  const handleAction = useCallback(
    async (actionId: 'pin' | 'mute') => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      utils.triggerHaptic('swipeAction');
      switch (actionId) {
        case 'pin':
          props.model.pin
            ? store.unpinItem(props.model.pin)
            : store.pinItem(props.model);
          break;
        case 'mute':
          isMuted ? store.unmuteChat(props.model) : store.muteChat(props.model);
          break;
        default:
          break;
      }
      swipeableRef.current?.close();
    },
    [props.model, isMuted]
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={(progress, drag) =>
        props.jailBroken ? (
          <LeftActions progress={progress} drag={drag} model={props.model} />
        ) : null
      }
      renderRightActions={(progress, drag) => (
        <RightActions
          progress={progress}
          drag={drag}
          model={props.model}
          handleAction={handleAction}
          isMuted={mutedState}
        />
      )}
      leftThreshold={1}
      rightThreshold={1}
      friction={1.5}
      overshootLeft={false}
      overshootRight={false}
    >
      {props.children}
    </Swipeable>
  );
}

function LeftActions({
  model,
  progress,
  drag,
}: {
  model: db.Channel;
  progress: Animated.AnimatedInterpolation<string | number>;
  drag: Animated.AnimatedInterpolation<string | number>;
}) {
  return (
    <XStack
      borderBottomLeftRadius="$m"
      borderTopLeftRadius="$m"
      overflow="hidden"
      width={180}
    >
      <Action
        side="left"
        backgroundColor="$red"
        color="$white"
        iconType="Close"
        progress={progress}
        drag={drag}
        xOffset={60}
        zIndex={3}
      />
      <Action
        side="left"
        backgroundColor="$indigo"
        color="$white"
        iconType="Bang"
        progress={progress}
        drag={drag}
        xOffset={120}
        zIndex={2}
      />
      <Action
        side="left"
        backgroundColor="$gray300"
        color="$white"
        iconType="Notifications"
        progress={progress}
        drag={drag}
        xOffset={180}
        zIndex={1}
      />
    </XStack>
  );
}

function RightActions({
  model,
  isMuted,
  progress,
  drag,
  handleAction,
}: {
  isMuted: boolean;
  model: db.Channel;
  progress: Animated.AnimatedInterpolation<string | number>;
  drag: Animated.AnimatedInterpolation<string | number>;
  handleAction: (actionId: 'pin' | 'mute') => void;
}) {
  return (
    <XStack
      borderBottomRightRadius="$m"
      borderTopRightRadius="$m"
      overflow="hidden"
      justifyContent="space-around"
      width={160}
    >
      <Action
        side="right"
        backgroundColor="$blueSoft"
        color="$gray800"
        iconType="Pin"
        xOffset={160}
        progress={progress}
        drag={drag}
        handleAction={() => handleAction('pin')}
      />
      <Action
        side="right"
        backgroundColor={isMuted ? '$gray800' : '$secondaryBackground'}
        color={isMuted ? '$secondaryBackground' : '$gray800'}
        iconType={isMuted ? 'Notifications' : 'Mute'}
        xOffset={80}
        progress={progress}
        drag={drag}
        handleAction={() => handleAction('mute')}
      />
    </XStack>
  );
}

function Action(
  props: ComponentProps<typeof Stack> & {
    backgroundColor: ColorTokens;
    color: ColorTokens;
    iconType: IconType;
    handleAction?: () => void;
    xOffset: number;
    progress: Animated.AnimatedInterpolation<string | number>;
    drag: Animated.AnimatedInterpolation<string | number>;
    side: 'left' | 'right';
    zIndex?: number;
  }
) {
  const { handleAction, backgroundColor, color, iconType, ...rest } = props;
  const translateX = props.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [props.side === 'left' ? -props.xOffset : props.xOffset, 0],
  });

  return (
    <Animated.View
      style={{
        transform: [{ translateX }],
        flex: 1,
        margin: 0,
        zIndex: props.zIndex ?? undefined,
      }}
    >
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={handleAction}
        activeOpacity={0.8}
      >
        <Stack
          flex={1}
          backgroundColor={backgroundColor}
          padding="$xl"
          alignItems="center"
          justifyContent="center"
          {...rest}
        >
          <Icon type={iconType} color={color} />
        </Stack>
      </TouchableOpacity>
    </Animated.View>
  );
}
