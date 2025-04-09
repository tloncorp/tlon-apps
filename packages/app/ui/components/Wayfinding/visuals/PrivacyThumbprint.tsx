import {
  Canvas,
  Circle,
  Group,
  Mask,
  Path,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { Dimensions } from 'react-native';

export const PrivacyThumbprint = () => {
  const size = 480;
  return (
    <Canvas
      style={{
        // flex: 1,
        height: size,
        width: size,
        backgroundColor: 'transparent',
      }}
    >
      <Mask mask={<RadialOpacityGradient />}>
        <SkiaSquiggles />
      </Mask>

      {/* <SkiaSquiggles /> */}
    </Canvas>
  );
};

const RadialOpacityGradient = () => {
  const radius = 792 / 2; // figma
  const xOffset = Dimensions.get('window').width / 2;
  const yOffset = 240;

  return (
    <Circle cx={xOffset} cy={yOffset} r={radius}>
      <RadialGradient
        c={vec(xOffset, yOffset)}
        r={radius}
        colors={[
          'rgba(255, 255, 255, 1)', // 100% opacity at center
          'rgba(255, 255, 255, 0.28)', // 28% opacity at 39%
          'rgba(255, 255, 255, 0.1)', // 10% opacity at 68%
          'rgba(255, 255, 255, 0)', // 0% opacity at 89%
        ]}
        positions={[0, 0.39, 0.68, 0.89]}
      />
    </Circle>
  );
};

const SkiaSquiggles = () => {
  const numSquiggles = 90;
  const squigglePath =
    'M629.946 -109.29C582.99 -62.3338 601.772 -43.5511 554.816 3.4055C507.859 50.3621 489.076 31.5795 442.12 78.5361C395.163 125.493 413.946 144.275 366.989 191.232C320.032 238.189 301.25 219.406 254.293 266.363C207.336 313.319 226.119 332.102 179.162 379.059C132.206 426.015 113.423 407.233 66.4665 454.189C19.5099 501.146 38.2925 519.929 -8.66407 566.885C-55.6207 613.842 -74.4033 595.059 -121.36 642.016';

  return (
    <Group opacity={0.6}>
      {Array.from({ length: numSquiggles }).map((_, index) => (
        <Path
          key={index}
          path={squigglePath}
          color="#CCCCCC"
          strokeWidth={2}
          style="stroke"
          // offset the squiggles
          transform={[
            { translateX: -(200 - index * 4.5) },
            { translateY: -(300 - index * 4.5) },
          ]}
        />
      ))}
    </Group>
  );
};
