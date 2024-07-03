import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';
import React, {
  ComponentProps,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, TouchableOpacity } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { ColorTokens, Stack } from 'tamagui';

import { XStack } from '../../core';
import * as utils from '../../utils';
import { Icon, IconType } from '../Icon';

function BaseSwipableChatRow({
  model,
  jailBroken,
  children,
}: PropsWithChildren<{ model: db.Channel; jailBroken?: boolean }>) {
  const swipeableRef = useRef<Swipeable | null>(null);
  const isMuted = useMemo(() => {
    if (model.group) {
      return model.group.volumeSettings?.isMuted ?? false;
    } else if (model.type === 'dm' || model.type === 'groupDm') {
      return model.volumeSettings?.isMuted ?? false;
    }

    return false;
  }, [model]);
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
          model.pin ? store.unpinItem(model.pin) : store.pinItem(model);
          break;
        case 'mute':
          isMuted ? store.unmuteChat(model) : store.muteChat(model);
          break;
        default:
          break;
      }
      swipeableRef.current?.close();
    },
    [model, isMuted]
  );

  const renderLeftActions = useCallback(
    (
      progress: Animated.AnimatedInterpolation<string | number>,
      drag: Animated.AnimatedInterpolation<string | number>
    ) => {
      return jailBroken ? (
        <LeftActions progress={progress} drag={drag} model={model} />
      ) : null;
    },
    [jailBroken, model]
  );

  const renderRightActions = useCallback(
    (
      progress: Animated.AnimatedInterpolation<string | number>,
      drag: Animated.AnimatedInterpolation<string | number>
    ) => {
      return (
        <RightActions
          progress={progress}
          drag={drag}
          model={model}
          isMuted={mutedState}
          handleAction={handleAction}
        />
      );
    },
    [handleAction, mutedState, model]
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      leftThreshold={1}
      rightThreshold={1}
      friction={1.5}
      overshootLeft={false}
      overshootRight={false}
    >
      {children}
    </Swipeable>
  );
}

export const SwipableChatListItem = React.memo(BaseSwipableChatRow);

function BaseLeftActions({
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

export const LeftActions = React.memo(BaseLeftActions);

function BaseRightActions({
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
        color="$darkBackground"
        iconType="Pin"
        xOffset={160}
        progress={progress}
        drag={drag}
        handleAction={() => handleAction('pin')}
      />
      <Action
        side="right"
        backgroundColor={isMuted ? '$darkBackground' : '$secondaryBackground'}
        color={isMuted ? '$secondaryText' : '$secondaryText'}
        iconType={isMuted ? 'Notifications' : 'Mute'}
        xOffset={80}
        progress={progress}
        drag={drag}
        handleAction={() => handleAction('mute')}
      />
    </XStack>
  );
}

export const RightActions = React.memo(BaseRightActions);

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
