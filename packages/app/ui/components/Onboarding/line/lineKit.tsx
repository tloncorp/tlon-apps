import { Text } from '@tloncorp/ui';
import {
  type ComponentClass,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  type PathProps,
  Rect,
  type RectProps,
} from 'react-native-svg';
import { type ColorTokens, View, useTheme } from 'tamagui';

import {
  AVATAR_GLYPHS,
  type AvatarGlyphId,
  GLYPH_SIZE,
  type GlyphShape,
} from './avatarGlyphs';

/** Every line in the onboarding drawings and lists is this one weight. */
export const LINE = 0.5;
/** A glyph fills this much of the tile it sits in. */
export const GLYPH_IN_TILE = 0.625;
/** A glyph's own lines, at the size its tile is drawn. */
const GLYPH_LINE = 1.6;
/** The side margin a drawing keeps on a narrow phone. */
const ART_MARGIN = 24;

export function useLineColors() {
  const theme = useTheme();
  return {
    ink: theme.primaryText?.val as string,
    paper: theme.background?.val as string,
  };
}

/**
 * A LINE-weight outline around its parent, drawn in SVG like the avatar
 * tiles. React Native's own 0.5 pt rounded borders come out uneven at 3x:
 * the top and left edges lose half a pixel. Put it last in a parent that has
 * a size, so it draws over the parent's content.
 */
export function LineOutline({
  radius,
  color = '$primaryText',
}: {
  radius: number;
  color?: ColorTokens;
}) {
  const stroke = useTokenColor(color);
  const [size, setSize] = useState<{ width: number; height: number }>();
  return (
    <View
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="none"
      onLayout={({ nativeEvent: { layout } }) => {
        // Layout can report 191.99997 for 192; snapped, the bottom line
        // lands on the parent's last pixel row.
        const width = PixelRatio.roundToNearestPixel(layout.width);
        const height = PixelRatio.roundToNearestPixel(layout.height);
        setSize((current) =>
          current?.width === width && current?.height === height
            ? current
            : { width, height }
        );
      }}
    >
      {size ? (
        // The canvas fills the parent rather than taking the measured size,
        // which an Svg can round down, cutting off the bottom line.
        <Svg width="100%" height="100%">
          <Rect
            x={LINE / 2}
            y={LINE / 2}
            width={size.width - LINE}
            height={size.height - LINE}
            rx={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={LINE}
          />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * A LINE-weight divider along the top of its parent, drawn like LineOutline:
 * a native 0.5 pt border comes out as two solid pixels at 3x, heavier than
 * every other line.
 */
export function LineRule({ color = '$primaryText' }: { color?: ColorTokens }) {
  const fill = useTokenColor(color);
  return (
    <Svg
      width="100%"
      height={1}
      style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      pointerEvents="none"
    >
      <Rect x={0} y={0} width="100%" height={LINE} fill={fill} />
    </Svg>
  );
}

function useTokenColor(color: ColorTokens) {
  const theme = useTheme() as unknown as Record<
    string,
    { val?: unknown } | undefined
  >;
  return theme[color.slice(1)]?.val as string | undefined;
}

/** Svg ids must be unique per drawing and can't carry React's colons. */
export function useSvgId(name: string) {
  return `${name}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

const AnimatedPath = Animated.createAnimatedComponent(
  Path as unknown as ComponentClass<PathProps>
);
const AnimatedRect = Animated.createAnimatedComponent(
  Rect as unknown as ComponentClass<RectProps>
);

/**
 * A clock that runs from 0 to 1 over and over. With Reduce Motion on it stays
 * at 0, which every drawing treats as its still frame.
 */
export function useLoop(durationMs: number): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    if (reduceMotion) return;
    t.value = withRepeat(
      withTiming(1, { duration: durationMs, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(t);
  }, [durationMs, reduceMotion, t]);
  return t;
}

const ArtContext = createContext({ width: 0 });

/**
 * A drawing at its design size, scaled down to fit a narrower phone. Labels
 * are app text placed over the lines, so they use the app's mono face.
 */
export function ArtCanvas({
  width,
  height,
  label,
  children,
}: {
  width: number;
  height: number;
  label: string;
  children: ReactNode;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const scale = Math.min(1, (windowWidth - 2 * ART_MARGIN) / width);
  return (
    <View
      width={width * scale}
      height={height * scale}
      alignSelf="center"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <View
        position="absolute"
        left={0}
        top={0}
        width={width}
        height={height}
        style={{
          // Scaled about its center, then moved back to the top left corner.
          transform: [
            { translateX: (width * (scale - 1)) / 2 },
            { translateY: (height * (scale - 1)) / 2 },
            { scale },
          ],
        }}
      >
        <ArtContext.Provider value={{ width }}>{children}</ArtContext.Provider>
      </View>
    </View>
  );
}

/** A mono caption in a drawing, placed by its baseline like SVG text. */
export function ArtLabel({
  x,
  y,
  anchor = 'start',
  children,
}: {
  x: number;
  y: number;
  anchor?: 'start' | 'end';
  children: string;
}) {
  const { width } = useContext(ArtContext);
  return (
    <Text
      position="absolute"
      top={y - 12}
      {...(anchor === 'start' ? { left: x } : { right: width - x })}
      fontFamily="$mono"
      fontSize={12}
      lineHeight={15}
      letterSpacing={0.6}
      color="$primaryText"
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

/**
 * A box filled with diagonal hatching, the walls of a drawing. Drawn as real
 * lines clipped to the box: an SVG pattern tiles them as broken dashes once
 * it's rotated on iOS.
 */
export function HatchedBox({
  x,
  y,
  width,
  height,
  spacing = 5,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The distance between lines, measured across them. */
  spacing?: number;
}) {
  const { ink, paper } = useLineColors();
  const clipId = useSvgId('hatch');
  // 45° lines spaced `spacing` apart cross the x axis this far apart.
  const step = spacing * Math.SQRT2;
  const lines: string[] = [];
  for (let offset = step / 2; offset < width + height; offset += step) {
    lines.push(`M${x + offset} ${y}L${x + offset - height} ${y + height}`);
  }
  return (
    <>
      <Defs>
        <ClipPath id={clipId}>
          <Rect x={x} y={y} width={width} height={height} />
        </ClipPath>
      </Defs>
      <Rect x={x} y={y} width={width} height={height} fill={paper} />
      <G clipPath={`url(#${clipId})`}>
        <Path d={lines.join('')} stroke={ink} strokeWidth={LINE} />
      </G>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={ink}
        strokeWidth={LINE}
      />
    </>
  );
}

function shapeElement(
  shape: GlyphShape,
  props: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: number[];
  },
  key?: number
) {
  const common = {
    fill: props.fill,
    stroke: props.stroke,
    strokeWidth: props.strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeDasharray: props.strokeDasharray,
  };
  return shape.kind === 'circle' ? (
    <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} {...common} />
  ) : (
    <Path
      key={key}
      d={shape.d}
      fillRule={shape.evenOdd ? 'evenodd' : undefined}
      {...common}
    />
  );
}

/**
 * One of the avatar glyphs inside a drawing.
 * - solid: dark body with light lines, how the Tlonbot is drawn
 * - inverse: light body with dark lines, the picked avatar on its dark tile
 * - line: outlines only, the avatars you haven't picked
 * - dashed: marching outlines, the Tlonbot still being set up
 */
export function GlyphMark({
  glyph,
  x,
  y,
  size,
  variant,
  lineWidth,
}: {
  glyph: AvatarGlyphId;
  x: number;
  y: number;
  size: number;
  variant: 'solid' | 'inverse' | 'line' | 'dashed';
  /** The glyph's own line weight, in points at this size. */
  lineWidth?: number;
}) {
  const { ink, paper } = useLineColors();
  const clipId = useSvgId('glyph-clip');
  const k = size / GLYPH_SIZE;
  const { body, details } = AVATAR_GLYPHS[glyph];
  if (variant === 'line' || variant === 'dashed') {
    return (
      <G transform={`translate(${x} ${y}) scale(${k})`}>
        <Defs>
          <ClipPath id={clipId}>
            {shapeElement(body, {
              fill: '#000',
              stroke: 'none',
              strokeWidth: 0,
            })}
          </ClipPath>
        </Defs>
        {variant === 'dashed' ? (
          <MarchingGlyph glyph={glyph} k={k} clipId={clipId} />
        ) : (
          <>
            {shapeElement(body, {
              fill: 'none',
              stroke: ink,
              strokeWidth: LINE / k,
            })}
            <G clipPath={`url(#${clipId})`}>
              {details.map((detail, index) =>
                shapeElement(
                  detail,
                  { fill: 'none', stroke: ink, strokeWidth: LINE / k },
                  index
                )
              )}
            </G>
          </>
        )}
      </G>
    );
  }
  const bodyColor = variant === 'solid' ? ink : paper;
  const lineColor = variant === 'solid' ? paper : ink;
  const weight = (lineWidth ?? GLYPH_LINE) / k;
  return (
    <G transform={`translate(${x} ${y}) scale(${k})`}>
      {shapeElement(body, {
        fill: bodyColor,
        stroke: lineColor,
        strokeWidth: weight,
      })}
      {details.map((detail, index) =>
        detail.role === 'fill'
          ? shapeElement(
              detail,
              { fill: lineColor, stroke: 'none', strokeWidth: 0 },
              index
            )
          : shapeElement(
              detail,
              { fill: 'none', stroke: lineColor, strokeWidth: weight },
              index
            )
      )}
    </G>
  );
}

const GLYPH_DASH = [4, 4];

function MarchingGlyph({
  glyph,
  k,
  clipId,
}: {
  glyph: AvatarGlyphId;
  k: number;
  clipId: string;
}) {
  const { ink } = useLineColors();
  const t = useLoop(1200);
  const span = 2 * (GLYPH_DASH[0] + GLYPH_DASH[1]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: span * (1 - t.value),
  }));
  const { body, details } = AVATAR_GLYPHS[glyph];
  const stroke = (shape: GlyphShape, index: number) =>
    shape.kind === 'circle' ? (
      <AnimatedPath
        key={index}
        d={circlePath(shape.cx, shape.cy, shape.r)}
        fill="none"
        stroke={ink}
        strokeWidth={LINE / k}
        strokeDasharray={GLYPH_DASH}
        strokeLinecap="round"
        animatedProps={animatedProps}
      />
    ) : (
      <AnimatedPath
        key={index}
        d={shape.d}
        fillRule={shape.evenOdd ? 'evenodd' : undefined}
        fill="none"
        stroke={ink}
        strokeWidth={LINE / k}
        strokeDasharray={GLYPH_DASH}
        strokeLinecap="round"
        animatedProps={animatedProps}
      />
    );
  return (
    <>
      {stroke(body, -1)}
      <G clipPath={`url(#${clipId})`}>{details.map(stroke)}</G>
    </>
  );
}

function circlePath(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
}

/** The Tlonbot: your glyph, solid, in a thin square tile. */
export function BotTile({
  glyph,
  x,
  y,
  size,
  glyphLineWidth,
}: {
  glyph: AvatarGlyphId;
  x: number;
  y: number;
  size: number;
  glyphLineWidth?: number;
}) {
  const { ink, paper } = useLineColors();
  const glyphSize = size * GLYPH_IN_TILE;
  const inset = (size - glyphSize) / 2;
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={size}
        height={size}
        fill={paper}
        stroke={ink}
        strokeWidth={LINE}
      />
      <GlyphMark
        glyph={glyph}
        x={x + inset}
        y={y + inset}
        size={glyphSize}
        variant="solid"
        lineWidth={glyphLineWidth}
      />
    </>
  );
}

/** You, in a drawing: a small solid square. */
export function YouMark({
  x,
  y,
  size = 8,
}: {
  x: number;
  y: number;
  size?: number;
}) {
  const { ink } = useLineColors();
  return <Rect x={x} y={y} width={size} height={size} fill={ink} />;
}

export function ArtLine({ d }: { d: string }) {
  const { ink } = useLineColors();
  return <Path d={d} stroke={ink} strokeWidth={LINE} fill="none" />;
}

export function ArtBox({
  x,
  y,
  width,
  height,
  fill,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
}) {
  const { ink, paper } = useLineColors();
  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill ?? paper}
      stroke={ink}
      strokeWidth={LINE}
    />
  );
}

/** A line with a small solid arrowhead at its end. */
export function ArtArrow({
  from,
  to,
}: {
  from: [number, number];
  to: [number, number];
}) {
  const { ink } = useLineColors();
  const [x1, y1] = from;
  const [x2, y2] = to;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  // The head is 5 pt long and 3.8 pt wide; the line stops where it starts.
  const bx = x2 - ux * 5;
  const by = y2 - uy * 5;
  const head = `M${x2} ${y2}L${bx - uy * 1.9} ${by + ux * 1.9}L${bx + uy * 1.9} ${by - ux * 1.9}Z`;
  return (
    <>
      <Path d={`M${x1} ${y1}L${bx} ${by}`} stroke={ink} strokeWidth={LINE} />
      <Path d={head} fill={ink} />
    </>
  );
}

/** A dashed line whose dashes walk along it. */
export function MarchingPath({
  d,
  dash = [4, 3],
  durationMs = 1000,
  reverse = false,
}: {
  d: string;
  dash?: [number, number];
  durationMs?: number;
  reverse?: boolean;
}) {
  const { ink } = useLineColors();
  const t = useLoop(durationMs);
  const span = 2 * (dash[0] + dash[1]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: reverse ? span * t.value : span * (1 - t.value),
  }));
  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={ink}
      strokeWidth={LINE}
      strokeDasharray={dash}
      animatedProps={animatedProps}
    />
  );
}

/** A dashed box whose dashes walk around it. */
export function MarchingBox({
  x,
  y,
  width,
  height,
  dash = [4, 3],
  durationMs = 1000,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  dash?: [number, number];
  durationMs?: number;
}) {
  const { ink, paper } = useLineColors();
  const t = useLoop(durationMs);
  const span = 2 * (dash[0] + dash[1]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: span * (1 - t.value),
  }));
  return (
    <AnimatedRect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={paper}
      stroke={ink}
      strokeWidth={LINE}
      strokeDasharray={dash}
      animatedProps={animatedProps}
    />
  );
}

/** Where a line ends: open until its choice is on, then filled. */
export function Port({ cx, cy, on }: { cx: number; cy: number; on: boolean }) {
  const { ink, paper } = useLineColors();
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={PORT_RADIUS}
      fill={on ? ink : paper}
      stroke={ink}
      strokeWidth={LINE}
    />
  );
}

export const PORT_RADIUS = 4;

/**
 * A line from `from` that stops just short of the port at `to`: solid when
 * its choice is on, marching dashes when it isn't.
 */
export function PortLine({
  from,
  to,
  on,
}: {
  from: [number, number];
  to: [number, number];
  on: boolean;
}) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const gap = PORT_RADIUS + 3;
  const ex = x2 - ((x2 - x1) / length) * gap;
  const ey = y2 - ((y2 - y1) / length) * gap;
  const d = `M${x1} ${y1}L${ex} ${ey}`;
  return (
    <>
      {on ? <ArtLine d={d} /> : <MarchingPath d={d} />}
      <Port cx={x2} cy={y2} on={on} />
    </>
  );
}

const easeInOut = Easing.bezierFn(0.42, 0, 0.58, 1);

/**
 * A small square that travels from (x, y) by (dx, dy), then fades: a message
 * moving along a line. Hidden with Reduce Motion on.
 */
export function Packet({
  x,
  y,
  dx,
  dy,
  durationMs = 4000,
  delayMs = 0,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  durationMs?: number;
  delayMs?: number;
}) {
  const { ink } = useLineColors();
  const reduceMotion = useReducedMotion();
  const t = useLoop(durationMs);
  const offset = delayMs / durationMs;
  const animatedProps = useAnimatedProps(() => {
    let p = (t.value - offset) % 1;
    if (p < 0) p += 1;
    let travelled = 1;
    let opacity = 0;
    if (p < 0.03) {
      travelled = 0;
      opacity = p / 0.03;
    } else if (p < 0.22) {
      travelled = easeInOut((p - 0.03) / 0.19);
      opacity = 1;
    } else if (p < 0.27) {
      opacity = 1 - (p - 0.22) / 0.05;
    }
    return { x: x + dx * travelled, y: y + dy * travelled, opacity };
  });
  if (reduceMotion) return null;
  return (
    <AnimatedRect
      width={4}
      height={4}
      fill={ink}
      animatedProps={animatedProps}
    />
  );
}

/** A box that fades in and out once a loop, the bot looking for you. */
export function PulseRing({
  x,
  y,
  size,
  durationMs = 3600,
}: {
  x: number;
  y: number;
  size: number;
  durationMs?: number;
}) {
  const { ink } = useLineColors();
  const reduceMotion = useReducedMotion();
  const t = useLoop(durationMs);
  const animatedProps = useAnimatedProps(() => {
    const p = t.value;
    const opacity =
      p < 0.22
        ? 0
        : p < 0.26
          ? (p - 0.22) / 0.04
          : p < 0.52
            ? 1
            : p < 0.64
              ? 1 - (p - 0.52) / 0.12
              : 0;
    return { opacity };
  });
  if (reduceMotion) return null;
  return (
    <AnimatedRect
      x={x}
      y={y}
      width={size}
      height={size}
      fill="none"
      stroke={ink}
      strokeWidth={LINE}
      animatedProps={animatedProps}
    />
  );
}

/**
 * A line that writes itself in, holds, then fades, like a message being
 * typed. Still and fully drawn with Reduce Motion on.
 */
export function TypedLine({
  x1,
  x2,
  y,
  delayMs = 0,
  durationMs = 4800,
}: {
  x1: number;
  x2: number;
  y: number;
  delayMs?: number;
  durationMs?: number;
}) {
  const { ink } = useLineColors();
  const reduceMotion = useReducedMotion();
  const t = useLoop(durationMs);
  const length = x2 - x1;
  const offset = delayMs / durationMs;
  const easeOut = Easing.bezierFn(0, 0, 0.58, 1);
  const animatedProps = useAnimatedProps(() => {
    if (reduceMotion) return { strokeDashoffset: 0, opacity: 1 };
    let p = (t.value - offset) % 1;
    if (p < 0) p += 1;
    const drawn = p < 0.12 ? easeOut(p / 0.12) : 1;
    const opacity = p < 0.8 ? 1 : p < 0.9 ? 1 - (p - 0.8) / 0.1 : 0;
    return { strokeDashoffset: length * (1 - drawn), opacity };
  });
  return (
    <AnimatedPath
      d={`M${x1} ${y}L${x2} ${y}`}
      stroke={ink}
      strokeWidth={LINE}
      strokeDasharray={[length, length]}
      animatedProps={animatedProps}
    />
  );
}
