// import { FontFamilyTokens } from "@tamagui/web";
import { FontFamilyTokens } from "@tamagui/core";
import {
  getTokenValue,
  SizeTokens,
  SpaceTokens,
  Token,
  getConfig,
  Variable,
} from "tamagui";

export { useTheme } from "tamagui";
export * from "./components/Button";
export * from "./components/Icon";
export * from "./components/ListItem";
export * from "./components/TamaguiProvider";
export * from "./components/Text";
export * from "./components/View";
export * from "./tamagui.config";
export * from "./components/UrbitSigil";

export const token = {
  size: (size: SizeTokens) => {
    return getTokenValue(size as Token, "size");
  },
  space: (space: SpaceTokens) => {
    return getTokenValue(space as Token, "space");
  },
  radius: (radius: string) => {
    return getTokenValue(radius as Token, "radius");
  },
};

export function getFont(name: FontFamilyTokens, size = "$true") {
  const font = getConfig().fontsParsed[name];
  if (!font) {
    console.warn("invalid font name", name);
    return null;
  }
  return {
    fontFamily: getFontTokenValue(font.family),
    fontSize: getFontTokenValue(font.size[size]),
    lineHeight: getFontTokenValue(font.lineHeight?.[size]),
    fontWeight: getFontTokenValue(font.weight?.[size]),
  };
}

function getFontTokenValue(
  token: string | number | Variable | undefined
): string | number | undefined {
  if (!token || typeof token === "string" || typeof token === "number") {
    return token;
  } else {
    return token.val;
  }
}
export { useStyle, ZStack, View } from "tamagui";
