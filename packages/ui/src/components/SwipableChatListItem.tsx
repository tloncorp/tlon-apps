import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';
import { ComponentProps, PropsWithChildren } from 'react';
import { Animated, TouchableOpacity } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { ColorTokens, Stack } from 'tamagui';

import { XStack } from '../core';
import { Icon, IconType } from './Icon';

export function SwipableChatRow(
  props: PropsWithChildren<{ model: db.ChannelSummary; jailBroken?: boolean }>
) {
  async function handleAction(actionId: 'pin' | 'placeholder') {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switch (actionId) {
      case 'pin':
        props.model.pin
          ? store.unpinItem(props.model.pin)
          : store.pinItem(props.model);
        break;
      default:
        break;
    }
  }

  return (
    <Swipeable
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
          jailBroken={props.jailBroken ?? false}
        />
      )}
      leftThreshold={1}
      rightThreshold={1}
      // friction={1.5}
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
  model: db.ChannelSummary;
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
  progress,
  drag,
  handleAction,
  jailBroken,
}: {
  jailBroken?: boolean;
  model: db.ChannelSummary;
  progress: Animated.AnimatedInterpolation<string | number>;
  drag: Animated.AnimatedInterpolation<string | number>;
  handleAction: (actionId: 'pin') => void;
}) {
  return (
    <XStack
      borderBottomRightRadius="$m"
      borderTopRightRadius="$m"
      overflow="hidden"
      justifyContent="space-around"
      width={jailBroken ? 120 : 80}
    >
      <Action
        side="right"
        backgroundColor={model.pin ? '$yellowSoft' : '$yellow'}
        color="$black"
        iconType="Pin"
        xOffset={120}
        progress={progress}
        drag={drag}
        handleAction={() => handleAction('pin')}
      />
      {jailBroken && (
        <Action
          side="right"
          backgroundColor="$green"
          color="$black"
          iconType="Channel"
          xOffset={60}
          progress={progress}
          drag={drag}
        />
      )}
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
