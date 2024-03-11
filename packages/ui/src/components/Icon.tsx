import React, { useMemo } from "react";
import {
  ColorTokens,
  SizeTokens,
  styled,
  View,
  withStaticProperties,
} from "tamagui";
import * as icons from "../assets/icons";

export type IconType = keyof typeof icons;

type IconProps = {
  type: IconType;
  color: string;
  width: number;
  height: number;
};

const RawIconGraphic = React.forwardRef(
  ({ type, color, width, height }: IconProps, ref) => {
    const IconComponent = icons[type];
    if (!IconComponent) {
      throw new Error("no icon found for " + type);
    }
    return (
      <IconComponent color={color} width={width} height={height} ref={ref} />
    );
  }
);

// Wrap icon graphic so we can use tokens to style it.
const IconGraphic = styled(
  RawIconGraphic,
  {},
  {
    acceptTokens: {
      color: "color",
      width: "size",
      height: "size",
    },
  }
);

const IconComponent = View.styleable<{
  size?: "$s" | "$m" | "$l";
  color?: ColorTokens;
  type: IconType;
}>(({ size = "$l", color = "$primaryText", type, ...props }, ref) => {
  const [frameSize, iconSize]: [SizeTokens, SizeTokens] = useMemo(() => {
    switch (size) {
      case "$s":
        return ["$l", "$l"];
      case "$m":
        return ["$2xl", "$2xl"];
      case "$l":
        return ["$3xl", "$2xl"];
    }
  }, [size]);
  return (
    <View
      ref={ref}
      width={frameSize}
      height={frameSize}
      alignItems="center"
      justifyContent="center"
      // borderWidth={1}
      // borderColor="$color.indigo"
      {...props}
    >
      <IconGraphic
        type={type}
        color={color}
        width={iconSize}
        height={iconSize}
      />
    </View>
  );
});

export const Icon = withStaticProperties(React.memo(IconComponent), {
  Graphic: IconGraphic,
});
