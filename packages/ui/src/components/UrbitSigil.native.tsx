import sigil from "@urbit/sigil-js/dist/core";
import { useMemo } from "react";
import { SvgXml } from "react-native-svg";
import { useTheme, View } from "tamagui";

export const UrbitSigil = View.styleable<{
  ship: string;
}>(({ ship, ...props }, ref) => {
  const validShip = ship.length <= 14; // planet or larger
  const theme = useTheme();
  const sigilXml = useMemo(
    () =>
      validShip
        ? sigil({
            point: ship,
            detail: "none",
            size: 12,
            space: "none",
            foreground: "#ffffff",
            background: theme.darkBackground.val,
          })
        : null,
    [ship]
  );
  return (
    <View
      ref={ref}
      width={20}
      height={20}
      alignItems="center"
      justifyContent="center"
      backgroundColor="$darkBackground"
      borderRadius="$2xs"
      {...props}
    >
      {sigilXml && <SvgXml xml={sigilXml} />}
    </View>
  );
});
