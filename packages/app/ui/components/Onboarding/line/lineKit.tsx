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
/** The corners of tiles and text fields. */
export const LINE_TILE_RADIUS = 12;
/** A glyph's own lines, at the size its tile is drawn. */
const GLYPH_LINE = 1.6;
/** The side margin a drawing keeps on a narrow phone. */
const ART_MARGIN = 24;

export function useLineColors() {
  const theme = useTheme();
  return {
    ink: theme.primaryText?.val as string,
    // Onboarding sits on the welcome screen's ground, so a box's fill hides
    // what's under it without showing as a patch.
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
  // The holder spans the parent's padding too; an Svg's own 100% width
  // would stop at the padding.
  return (
    <View
      position="absolute"
      top={0}
      left={0}
      right={0}
      height={1}
      pointerEvents="none"
    >
      <Svg width="100%" height={1}>
        <Rect x={0} y={0} width="100%" height={LINE} fill={fill} />
      </Svg>
    </View>
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

const ArtContext = createContext({ width: 0, height: 0, scale: 1 });

/**
 * A drawing at its design size, scaled down to fit a narrower phone.
 *
 * `scale` draws it at another size than its design size: the geometry
 * changes, while its lines and hatching keep their size on screen. `foot` is the
 * drawing's lowest point when that's a line with room under it for its
 * stroke; the box ends there, so what's under the drawing spaces from it.
 * `head` is the design y of its top line: drawings are traced with a unit of
 * room above it for the stroke, and the box starts at the line, so content
 * above spaces from it.
 */
export function ArtCanvas({
  width,
  height,
  scale = 1,
  foot = height,
  head = 1,
  label,
  children,
}: {
  width: number;
  height: number;
  scale?: number;
  foot?: number;
  head?: number;
  label: string;
  children: ReactNode;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  const fit = Math.min(1, (windowWidth - 2 * ART_MARGIN) / drawnWidth);
  return (
    <View
      width={drawnWidth * fit}
      height={(foot - head) * scale * fit}
      alignSelf="center"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <View
        position="absolute"
        left={0}
        top={-head * scale * fit}
        width={drawnWidth}
        height={drawnHeight}
        style={{
          // Scaled about its center, then moved back to the top left corner.
          transform: [
            { translateX: (drawnWidth * (fit - 1)) / 2 },
            { translateY: (drawnHeight * (fit - 1)) / 2 },
            { scale: fit },
          ],
        }}
      >
        <ArtContext.Provider value={{ width, height, scale }}>
          {children}
        </ArtContext.Provider>
      </View>
    </View>
  );
}

/** A drawing's lines, in its design units, at its ArtCanvas scale. */
export function ArtSvg({ children }: { children: ReactNode }) {
  const { width, height, scale } = useContext(ArtContext);
  return (
    <Svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
    >
      {children}
    </Svg>
  );
}

/** LINE in a drawing's design units, so it stays LINE on screen. */
function useArtLine() {
  return LINE / useContext(ArtContext).scale;
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
  radius = 0,
  spacing = 5,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  /** The distance between lines on screen, measured across them. */
  spacing?: number;
}) {
  const { ink, paper } = useLineColors();
  const line = useArtLine();
  const { scale } = useContext(ArtContext);
  const clipId = useSvgId('hatch');
  // 45° lines spaced `spacing` apart cross the x axis this far apart.
  const step = (spacing / scale) * Math.SQRT2;
  const lines: string[] = [];
  for (let offset = step / 2; offset < width + height; offset += step) {
    lines.push(`M${x + offset} ${y}L${x + offset - height} ${y + height}`);
  }
  return (
    <>
      <Defs>
        <ClipPath id={clipId}>
          <Rect x={x} y={y} width={width} height={height} rx={radius} />
        </ClipPath>
      </Defs>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={radius}
        fill={paper}
      />
      <G clipPath={`url(#${clipId})`}>
        <Path d={lines.join('')} stroke={ink} strokeWidth={line} />
      </G>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={radius}
        fill="none"
        stroke={ink}
        strokeWidth={line}
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
  const line = useArtLine();
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
              strokeWidth: line / k,
            })}
            <G clipPath={`url(#${clipId})`}>
              {details.map((detail, index) =>
                shapeElement(
                  detail,
                  { fill: 'none', stroke: ink, strokeWidth: line / k },
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
  const line = useArtLine();
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
        strokeWidth={line / k}
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
        strokeWidth={line / k}
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

/** The Tlonbot: your glyph, solid, in a thin rounded tile. */
export function BotTile({
  glyph,
  x,
  y,
  size,
  radius = LINE_TILE_RADIUS,
  glyphSize,
  glyphLineWidth,
}: {
  glyph: AvatarGlyphId;
  x: number;
  y: number;
  size: number;
  radius?: number;
  glyphSize?: number;
  glyphLineWidth?: number;
}) {
  const { ink, paper } = useLineColors();
  const line = useArtLine();
  const glyphDrawn = glyphSize ?? size * GLYPH_IN_TILE;
  const inset = (size - glyphDrawn) / 2;
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={radius}
        fill={paper}
        stroke={ink}
        strokeWidth={line}
      />
      <GlyphMark
        glyph={glyph}
        x={x + inset}
        y={y + inset}
        size={glyphDrawn}
        variant="solid"
        lineWidth={glyphLineWidth}
      />
    </>
  );
}

export function ArtLine({ d }: { d: string }) {
  const { ink } = useLineColors();
  const line = useArtLine();
  return <Path d={d} stroke={ink} strokeWidth={line} fill="none" />;
}

export function ArtBox({
  x,
  y,
  width,
  height,
  radius = 0,
  fill,
  dash,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  fill?: string;
  /** A still dash, for an empty place. */
  dash?: [number, number];
}) {
  const { ink, paper } = useLineColors();
  const line = useArtLine();
  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={radius}
      strokeDasharray={dash}
      fill={fill ?? paper}
      stroke={ink}
      strokeWidth={line}
    />
  );
}

/**
 * A line with a small solid arrowhead at its end. With `via`, it bends
 * through those points first, and the head points along the last leg.
 */
export function ArtArrow({
  from,
  to,
  via = [],
  dashed = false,
}: {
  from: [number, number];
  to: [number, number];
  via?: [number, number][];
  /** Marching dashes up to the head, for a way not taken yet. */
  dashed?: boolean;
}) {
  const { ink } = useLineColors();
  const line = useArtLine();
  const [x1, y1] = via.length ? via[via.length - 1] : from;
  const [x2, y2] = to;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  // The head is 5 pt long and 3.8 pt wide; the line stops where it starts.
  const bx = x2 - ux * 5;
  const by = y2 - uy * 5;
  const head = `M${x2} ${y2}L${bx - uy * 1.9} ${by + ux * 1.9}L${bx + uy * 1.9} ${by - ux * 1.9}Z`;
  const shaft = `M${from[0]} ${from[1]}${via
    .map(([x, y]) => `L${x} ${y}`)
    .join('')}L${bx} ${by}`;
  return (
    <>
      {dashed ? (
        <MarchingPath d={shaft} />
      ) : (
        <Path d={shaft} stroke={ink} strokeWidth={line} fill="none" />
      )}
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
  const line = useArtLine();
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
      strokeWidth={line}
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
  radius = 0,
  dash = [4, 3],
  durationMs = 1000,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  dash?: [number, number];
  durationMs?: number;
}) {
  const { ink, paper } = useLineColors();
  const line = useArtLine();
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
      rx={radius}
      fill={paper}
      stroke={ink}
      strokeWidth={line}
      strokeDasharray={dash}
      animatedProps={animatedProps}
    />
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
