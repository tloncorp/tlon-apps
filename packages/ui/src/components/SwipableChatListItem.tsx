import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps, PropsWithChildren } from 'react';
import { TouchableOpacity } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { ColorTokens, Stack } from 'tamagui';

import { View, XStack } from '../core';
import { Icon, IconType } from './Icon';

export function SwipableChatRow(
  props: PropsWithChildren<{ model: db.ChannelSummary }>
) {
  // TODO: handle actions lol

  return (
    <Swipeable
      renderLeftActions={() => <LeftActions />}
      renderRightActions={() => <RightActions />}
      friction={2}
    >
      {props.children}
    </Swipeable>
  );
}

function LeftActions() {
  return (
    <XStack
      borderBottomLeftRadius="$m"
      borderTopLeftRadius="$m"
      overflow="hidden"
    >
      <Action backgroundColor="$red" color="$white" iconType="Close" />
      <Action backgroundColor="$indigo" color="$white" iconType="Bang" />
      <Action
        backgroundColor="$gray300"
        color="$white"
        iconType="Notifications"
      />
    </XStack>
  );
}

function RightActions() {
  return (
    <XStack
      borderBottomRightRadius="$m"
      borderTopRightRadius="$m"
      overflow="hidden"
    >
      <Action backgroundColor="$yellow" color="$black" iconType="Pin" />
      <Action backgroundColor="$green" color="$black" iconType="Channel" />
    </XStack>
  );
}

function Action(
  props: ComponentProps<typeof Stack> & {
    backgroundColor: ColorTokens;
    color: ColorTokens;
    iconType: IconType;
    handleAction?: () => void;
  }
) {
  const { handleAction, backgroundColor, color, iconType, ...rest } = props;
  return (
    <TouchableOpacity onPress={handleAction} activeOpacity={0.8}>
      <Stack
        flex={1}
        backgroundColor={backgroundColor}
        padding="$xl"
        justifyContent="center"
        alignItems="center"
        {...rest}
      >
        <Icon type={iconType} color={color} />
      </Stack>
    </TouchableOpacity>
  );
}
