import React, { ComponentProps, PropsWithChildren, ReactElement } from "react";
import RemoteSvg from "./RemoteSvg";
import { styled, View, withStaticProperties } from "tamagui";
import { SizableText, Stack, XStack, YStack, Image, Text } from "tamagui";
import { Icon } from "./Icon";

export interface BaseListItemProps<T> {
  model: T;
  StartIcon?: ReactElement | null;
  EndIcon?: ReactElement | null;
  onPress?: (model: T) => void;
  onLongPress?: (model: T) => void;
  highlighted?: boolean;
}

export type ListItemProps<T> = BaseListItemProps<T> &
  Omit<ComponentProps<typeof ListItemFrame>, keyof BaseListItemProps<T>>;

export const ListItemFrame = styled(XStack, {
  name: "ListItemFrame",
  padding: "$l",
  borderRadius: "$xl",
  flexDirection: "row",
  flexShrink: 1,
  gap: "$l",
  justifyContent: "space-between",
  alignItems: "stretch",
  variants: {
    pressable: {
      true: {
        pressStyle: {
          backgroundColor: "$secondaryBackground",
        },
      },
    },
  } as const,
  defaultVariants: {
    pressable: true,
  },
});

function ListItemIcon({
  imageUrl,
  backgroundColor,
  fallbackText,
  ...props
}: PropsWithChildren<{
  imageUrl?: string;
  backgroundColor?: string;
  /**
   * Text to display when there's no image set. Should be a single character.
   */
  fallbackText?: string;
}>) {
  const resolvedBackgroundColor = backgroundColor ?? "$secondaryBackground";
  const size = "$4xl";
  return imageUrl ? (
    imageUrl.includes(".svg") ? (
      <View
        width={size}
        height={size}
        borderRadius="$s"
        //@ts-ignore This is an arbitrary, user-set color
        backgroundColor={resolvedBackgroundColor}
        overflow="hidden"
        {...props}
      >
        <RemoteSvg width="100%" height="100%" uri={imageUrl} />
      </View>
    ) : (
      <Image
        width={size}
        height={size}
        borderRadius="$s"
        //@ts-ignore This is an arbitrary, user-set color
        backgroundColor={resolvedBackgroundColor}
        {...props}
        source={{
          uri: imageUrl,
        }}
      />
    )
  ) : (
    <Stack
      //@ts-ignore This is an arbitrary, user-set color
      backgroundColor={resolvedBackgroundColor}
      borderRadius="$s"
      alignItems="center"
      justifyContent="center"
      width={size}
      height={size}
    >
      {fallbackText ? (
        <Text fontSize={16} color="$primaryText">
          {fallbackText.toUpperCase()}
        </Text>
      ) : null}
    </Stack>
  );
}

const ListItemMainContent = styled(YStack, {
  flex: 1,
  justifyContent: "center",
  height: "$4xl",
  paddingVertical: "$xs",
});

const ListItemTitle = styled(SizableText, {
  numberOfLines: 1,
  lineHeight: 0,
  alignItems: "baseline",
  color: "$secondaryText",
});

const ListItemTitleRow = styled(XStack, {
  gap: "$s",
  alignItems: "center",
  overflow: "hidden",
});

function ListItemTitleAttribute({ children }: PropsWithChildren) {
  return (
    <Stack
      paddingHorizontal="$s"
      backgroundColor="$positiveBackground"
      borderRadius="$xl"
      paddingTop={2}
      paddingBottom={1}
      borderWidth={1}
      borderColor="$positiveBorder"
    >
      <SizableText size="$s" lineHeight={0} color="$secondaryText">
        {children}
      </SizableText>
    </Stack>
  );
}

const ListItemSubtitle = styled(SizableText, {
  numberOfLines: 1,
  size: "$s",
  lineHeight: 0,
  color: "$secondaryText",
});

const ListItemTimeText = styled(SizableText, {
  numberOfLines: 1,
  color: "$secondaryText",
  size: "$s",
});

const ListItemCount = ({ children }: PropsWithChildren) => {
  return (
    <Stack
      paddingHorizontal="$s"
      backgroundColor="$secondaryBackground"
      borderRadius="$xl"
    >
      <SizableText
        size="$s"
        lineHeight={0}
        color="$secondaryText"
        textAlign="center"
      >
        {children}
      </SizableText>
    </Stack>
  );
};

const ListItemComponent = ({
  StartIcon,
  EndIcon,
  children,
  ...props
}: {
  StartIcon?: ReactElement | null;
  EndIcon?: ReactElement | null;
  highlighted?: boolean;
} & ComponentProps<typeof ListItemFrame>) => {
  return (
    <ListItemFrame {...props}>
      {StartIcon ?? null}
      {children}
      {EndIcon ?? null}
    </ListItemFrame>
  );
};

const Dragger = () => {
  return (
    <YStack alignItems="center" justifyContent="center">
      <Icon type="Dragger" width="$2xl" height="$2xl" />
    </YStack>
  );
};

const ListItemEndContent = styled(YStack, {
  flex: 0,
  paddingTop: "$s",
  height: "$4xl",
  paddingVertical: "$xs",
  justifyContent: "space-between",
  alignItems: "flex-end",
});

export type ListItem = typeof ListItemComponent;

export const ListItem = withStaticProperties(ListItemComponent, {
  Icon: ListItemIcon,
  Dragger,
  Count: ListItemCount,
  MainContent: ListItemMainContent,
  TitleRow: ListItemTitleRow,
  Title: ListItemTitle,
  TitleAttribute: ListItemTitleAttribute,
  Subtitle: ListItemSubtitle,
  EndContent: ListItemEndContent,
  Time: ListItemTimeText,
});
