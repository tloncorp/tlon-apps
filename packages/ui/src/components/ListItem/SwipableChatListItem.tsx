import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import * as Haptics from 'expo-haptics';
import React, {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Swipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { ColorTokens, Stack, View, getTokenValue } from 'tamagui';

import * as utils from '../../utils';
import { Chat } from '../ChatList';
import { Icon, IconType } from '../Icon';
import { ChatListItem } from './ChatListItem';
import { ListItemProps } from './ListItem';
import { useBoundHandler } from './listItemUtils';

function BaseSwipableChatRow({
  model,
  onPress,
  onLongPress,
}: ListItemProps<Chat> & { model: db.Channel }) {
  const swipeableRef = useRef<SwipeableMethods>(null);

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

  const renderRightActions = useCallback(
    (progress: SharedValue<number>, drag: SharedValue<number>) => {
      return (
        <RightActions
          progress={progress}
          drag={drag}
          isMuted={mutedState}
          handleAction={handleAction}
        />
      );
    },
    [handleAction, mutedState]
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      leftThreshold={1}
      rightThreshold={1}
      friction={1.5}
      overshootLeft={false}
      overshootRight={false}
    >
      <ChatListItem model={model} onPress={onPress} onLongPress={onLongPress} />
    </Swipeable>
  );
}

export const SwipableChatListItem = React.memo(BaseSwipableChatRow);

function BaseRightActions({
  isMuted,
  drag,
  handleAction,
}: {
  isMuted: boolean;
  progress: SharedValue<number>;
  drag: SharedValue<number>;
  handleAction: (actionId: 'pin' | 'mute') => void;
}) {
  const handlePin = useBoundHandler('pin', handleAction);
  const handleMute = useBoundHandler('mute', handleAction);

  const containerStyle = useAnimatedStyle(() => ({
    width: Math.abs(drag.value),
    flexDirection: 'row',
    overflow: 'hidden',
  }));

  return (
    <View width={160} justifyContent="flex-end" flexDirection="row">
      <Animated.View
        style={[
          containerStyle,
          {
            borderBottomRightRadius: getTokenValue('$m', 'radius'),
            borderTopRightRadius: getTokenValue('$m', 'radius'),
          },
        ]}
      >
        <Action
          backgroundColor="$blueSoft"
          color="$darkBackground"
          iconType="Pin"
          handleAction={handlePin}
        />
        <Action
          backgroundColor={isMuted ? '$darkBackground' : '$secondaryBackground'}
          color={isMuted ? '$secondaryText' : '$secondaryText'}
          iconType={isMuted ? 'Notifications' : 'Mute'}
          handleAction={handleMute}
        />
      </Animated.View>
    </View>
  );
}

export const RightActions = React.memo(BaseRightActions);

function Action({
  backgroundColor,
  handleAction,
  color,
  iconType,
}: ComponentProps<typeof Stack> & {
  backgroundColor: ColorTokens;
  color: ColorTokens;
  iconType: IconType;
  handleAction?: () => void;
}) {
  return (
    <View flex={0.5}>
      <Icon
        minWidth={80}
        type={iconType}
        color={color}
        flex={1}
        alignItems="center"
        justifyContent="center"
        backgroundColor={backgroundColor}
        onPress={handleAction}
        pressStyle={{
          opacity: 0.8,
        }}
      />
    </View>
  );
}
