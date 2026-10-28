import Svg, { G, Path } from 'react-native-svg';
import { useTheme } from 'tamagui';

import { HEADS, SPARKLES, VIEW_BOX } from './pillHeadsParts';

// The animation drives native SVG props from Reanimated, which isn't checked
// on web, so the web shows the heads at rest.
export function AnimatedPillHeads() {
  const theme = useTheme();
  const ink = theme.primaryText.val;
  // The screen's background, so a head hides the lines behind it.
  const paper = theme.secondaryBackground.val;

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`}
    >
      {SPARKLES.map((sparkle) => (
        <Path
          key={sparkle.name}
          transform={`translate(${sparkle.x} ${sparkle.y})`}
          d={sparkle.path}
          fill={ink}
          fillRule="evenodd"
        />
      ))}
      {HEADS.map((head, index) => (
        <G key={head.name} transform={`translate(${head.x} ${head.y})`}>
          {index > 0 ? <Path d={head.outline} fill={paper} /> : null}
          <Path d={head.outline + head.holes} fill={ink} fillRule="evenodd" />
          {head.features.map((feature) => (
            <Path
              key={feature.name}
              transform={`translate(${feature.x} ${feature.y})`}
              d={feature.path}
              fill={ink}
              fillRule="evenodd"
            />
          ))}
        </G>
      ))}
    </Svg>
  );
}
