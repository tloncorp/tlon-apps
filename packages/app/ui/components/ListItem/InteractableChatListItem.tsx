import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Icon, IconType } from '@tloncorp/ui';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Swipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { ColorTokens, View, getTokenValue, isWeb } from 'tamagui';

import * as utils from '../../utils';
import { ChatListItem } from './ChatListItem';
import { ListItemProps } from './ListItem';
import { useBoundHandler } from './listItemUtils';

function BaseInteractableChatRow({
  model,
  onPress,
  onLongPress,
  onLayout,
  ...props
}: ListItemProps<db.Chat> & { onLayout?: (e: any) => void }) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const [currentSwipeDirection, setCurrentSwipeDirection] = useState<
    'left' | 'right' | null
  >(null);

  const isMuted = useMemo(() => {
    return logic.isMuted(model.volumeSettings?.level, model.type);
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

  const handleAction = logic.useMutableCallback(
    async (actionId: 'pin' | 'mute' | 'markRead') => {
      utils.triggerHaptic('swipeAction');
      switch (actionId) {
        case 'pin':
          model.pin ? store.unpinItem(model.pin) : store.pinChat(model);
          break;
        case 'mute':
          isMuted ? store.unmuteChat(model) : store.muteChat(model);
          break;
        case 'markRead':
          if (model.type === 'group') {
            store.markGroupRead(model.id, true);
          } else {
            store.markChannelRead({
              id: model.id,
              groupId: model.channel.groupId ?? undefined,
            });
          }
          break;
        default:
          break;
      }
      swipeableRef.current?.close();
    }
  );

  const onSwipeableWillOpen = useCallback((direction: 'left' | 'right') => {
    setCurrentSwipeDirection(direction);
  }, []);

  const onSwipeableClose = useCallback(() => {
    setCurrentSwipeDirection(null);
  }, []);

  const renderLeftActions = useCallback(
    (progress: SharedValue<number>, drag: SharedValue<number>) => {
      const hasUnread = model.unreadCount > 0;

      if (currentSwipeDirection === 'right' || !hasUnread) {
        return <View />;
      }

      return (
        <LeftActions
          progress={progress}
          drag={drag}
          handleAction={handleAction}
        />
      );
    },
    [model.unreadCount, currentSwipeDirection, handleAction]
  );

  const renderRightActions = useCallback(
    (progress: SharedValue<number>, drag: SharedValue<number>) => {
      if (currentSwipeDirection === 'left') {
        return <View />;
      }

      return (
        <RightActions
          progress={progress}
          drag={drag}
          isMuted={mutedState}
          handleAction={handleAction}
        />
      );
    },
    [handleAction, mutedState, currentSwipeDirection]
  );

  if (!isWeb) {
    return (
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onSwipeableClose={onSwipeableClose}
        leftThreshold={1}
        rightThreshold={1}
        friction={1.5}
        overshootLeft={false}
        overshootRight={false}
      >
        <ChatListItem
          model={model}
          onPress={onPress}
          onLongPress={onLongPress}
          onLayout={onLayout}
          {...props}
        />
      </Swipeable>
    );
  } else {
    return (
      <ChatListItem
        model={model}
        onPress={onPress}
        onLongPress={onLongPress}
        onLayout={onLayout}
        {...props}
      />
    );
  }
}

export const InteractableChatListItem = React.memo(BaseInteractableChatRow);

function BaseLeftActions({
  drag,
  handleAction,
}: {
  drag: SharedValue<number>;
  progress: SharedValue<number>;
  handleAction: (actionId: 'markRead') => void;
}) {
  const handleRead = useBoundHandler('markRead', handleAction);

  const containerWidthStyle = useAnimatedStyle(
    () => ({
      width: Math.abs(drag.value),
    }),
    [drag]
  );

  const containerStyle: StyleProp<ViewStyle> = useMemo(() => {
    return [
      containerWidthStyle,
      {
        flexDirection: 'row',
        overflow: 'hidden',
        borderBottomLeftRadius: getTokenValue('$m', 'radius'),
        borderTopLeftRadius: getTokenValue('$m', 'radius'),
      },
    ] as const;
  }, [containerWidthStyle]);

  return (
    <View width={80} justifyContent="flex-start" flexDirection="row">
      <Animated.View style={containerStyle}>
        <Action
          backgroundColor={"$green" as ColorTokens}
          color={"$darkBackground" as ColorTokens}
          iconType="Checkmark"
          handleAction={handleRead}
        />
      </Animated.View>
    </View>
  );
}

export const LeftActions = React.memo(BaseLeftActions);

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

  const containerWidthStyle = useAnimatedStyle(
    () => ({
      width: Math.abs(drag.value),
    }),
    [drag]
  );

  const containerStyle: StyleProp<ViewStyle> = useMemo(() => {
    return [
      containerWidthStyle,
      {
        flexDirection: 'row',
        overflow: 'hidden',
        borderBottomRightRadius: getTokenValue('$m', 'radius'),
        borderTopRightRadius: getTokenValue('$m', 'radius'),
      },
    ] as const;
  }, [containerWidthStyle]);

  return (
    <View width={160} justifyContent="flex-end" flexDirection="row">
      <Animated.View style={containerStyle}>
        <Action
          backgroundColor={"$blueSoft" as ColorTokens}
          color={"$darkBackground" as ColorTokens}
          iconType="Pin"
          handleAction={handlePin}
        />
        <Action
          backgroundColor={(isMuted ? '$darkBackground' : '$secondaryBackground') as ColorTokens}
          color={"$secondaryText" as ColorTokens}
          iconType={isMuted ? 'Notifications' : 'Muted'}
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
}: {
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
