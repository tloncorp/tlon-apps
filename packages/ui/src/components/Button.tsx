import { getSize } from "@tamagui/get-token";
import {
  SizeTokens,
  Stack,
  Text,
  createStyledContext,
  styled,
  useTheme,
  withStaticProperties,
} from "tamagui";
import { cloneElement, useContext } from "react";

export const ButtonContext = createStyledContext<{ size: SizeTokens }>({
  size: "$m",
});

export const ButtonFrame = styled(Stack, {
  name: "Button",
  context: ButtonContext,
  backgroundColor: "$background",
  alignItems: "center",
  flexDirection: "row",
  pressStyle: {
    backgroundColor: "$positiveBackground",
  },
  borderColor: "$border",
  borderWidth: 1,
  borderRadius: "$m",
  paddingVertical: "$s",
  paddingHorizontal: "$l",
});

export const ButtonText = styled(Text, {
  name: "ButtonText",
  context: ButtonContext,
  color: "$primaryText",
  userSelect: "none",

  variants: {
    size: {
      "...fontSize": (name, { font }) => ({
        fontSize: font?.size[name],
      }),
    },
  } as const,
});

const ButtonIcon = (props: { children: any }) => {
  const { size } = useContext(ButtonContext.context);
  const smaller = getSize(size, {
    shift: -2,
  });
  const theme = useTheme();
  return cloneElement(props.children, {
    size: smaller.val * 0.5,
    color: theme.primaryText.get(),
  });
};

export const Button = withStaticProperties(ButtonFrame, {
  Props: ButtonContext.Provider,
  Text: ButtonText,
  Icon: ButtonIcon,
});
