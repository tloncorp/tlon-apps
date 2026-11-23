import { G } from 'react-native-svg';

import type { AvatarGlyphId } from './avatarGlyphs';
import {
  ArtArrow,
  ArtBox,
  ArtCanvas,
  ArtLine,
  ArtSvg,
  BotTile,
  GlyphMark,
  HatchedBox,
  LINE_TILE_RADIUS,
  MarchingBox,
  MarchingPath,
  Packet,
  useLineColors,
} from './lineKit';

// Each drawing is traced from its board on the onboarding implementation
// canvas, in a box cropped to its ink, so the screens can space it from the
// list under it. Every box and tile has rounded corners, as on the canvas's
// rounded row.

/** Setting up: your computer's walls, and the Tlonbot still in dashes. */
export function SetupArt({ glyph }: { glyph: AvatarGlyphId }) {
  return (
    <ArtCanvas
      width={242}
      height={242}
      scale={0.6}
      foot={241}
      label="Your Tlon computer, with your Tlonbot inside it, still being set up"
    >
      <ArtSvg>
        <HatchedBox x={1} y={1} width={240} height={240} radius={16} />
        <ArtBox x={19} y={19} width={204} height={204} radius={16} />
        <MarchingBox x={69} y={69} width={104} height={104} radius={16} />
        <GlyphMark glyph={glyph} x={88.5} y={88.5} size={65} variant="dashed" />
      </ArtSvg>
    </ArtCanvas>
  );
}

/** The three boxes on Meet your Tlonbot, from the top. */
const MEET_BOXES = [1, 43, 85];

/**
 * Meet your Tlonbot: arrows from the Tlonbot to chat lines, three people and
 * a row of apps.
 */
export function MeetArt({ glyph }: { glyph: AvatarGlyphId }) {
  return (
    <ArtCanvas
      width={268}
      height={118}
      foot={117}
      scale={1.2414}
      label="Your Tlonbot, with straight arrows to chat lines, three people and a row of apps"
    >
      <ArtSvg>
        {MEET_BOXES.map((y) => (
          <ArtBox key={y} x={195} y={y} width={72} height={32} radius={5} />
        ))}
        <ArtLine d="M205 13L241 13M221 21L257 21" />
        {[213, 231, 249].map((cx) => (
          <ArtLine
            key={cx}
            d={`${circle(cx, 55, 3)}M${cx - 6} 67A6 6 0 0 1 ${cx + 6} 67`}
          />
        ))}
        {[207, 220, 233, 246].map((x) => (
          <ArtBox key={x} x={x} y={96.5} width={9} height={9} fill="none" />
        ))}
        {MEET_BOXES.map((y) => (
          <ArtArrow key={y} from={[127, y + 16]} to={[189, y + 16]} />
        ))}
        <BotTile
          glyph={glyph}
          x={1}
          y={1}
          size={116}
          radius={16}
          glyphLineWidth={1.6}
        />
        {MEET_BOXES.map((y, index) => (
          <Packet
            key={y}
            x={125}
            y={y + 14}
            dx={57}
            dy={0}
            delayMs={900 + 200 * index}
          />
        ))}
      </ArtSvg>
    </ArtCanvas>
  );
}

/** The rows of dashed lines on Yours to keep, from the top. */
const KEEP_ROWS = [37, 73, 109];

/**
 * Yours to keep: the Tlonbot inside your computer's thick walls, with dashed
 * lines from outside stopping short of them.
 */
export function PrivateArt({ glyph }: { glyph: AvatarGlyphId }) {
  return (
    <ArtCanvas
      width={234}
      height={146}
      foot={145}
      label="Your Tlonbot inside your computer's thick walls, with dashed lines from outside stopping short of them"
    >
      <ArtSvg>
        <HatchedBox x={45} y={1} width={144} height={144} radius={16} />
        <ArtBox x={69} y={25} width={96} height={96} radius={12} />
        {KEEP_ROWS.map((y) => (
          <G key={y}>
            <MarchingPath d={`M1 ${y}L37 ${y}`} />
            <ArtLine d={`M39 ${y - 5}L39 ${y + 5}`} />
            <MarchingPath d={`M233 ${y}L197 ${y}`} />
            <ArtLine d={`M195 ${y - 5}L195 ${y + 5}`} />
          </G>
        ))}
        <BotTile
          glyph={glyph}
          x={91}
          y={47}
          size={52}
          glyphSize={34}
          glyphLineWidth={1}
        />
      </ArtSvg>
    </ArtCanvas>
  );
}

/**
 * A connected service's tile, or the picked model's, gets a second outline
 * 3 units inside its first, its corners following the tile's.
 */
const INNER_OUTLINE_RADIUS = LINE_TILE_RADIUS - 3;

/** What a service's tile on Connect your services shows. */
export type ServiceDrawingIcon = 'calendar' | 'mail' | 'branch' | 'page';

const CONNECT_BOX = { x: 159, size: 40, step: 52 };
const CONNECT_TILE = 64;

/**
 * Connect your services: a line from the Tlonbot to a tile per service,
 * marching until it's connected, then solid, and the tile gets a second
 * outline.
 */
export function ConnectArt({
  glyph,
  services,
}: {
  glyph: AvatarGlyphId;
  /** One entry per featured service, in list order. */
  services: { icon: ServiceDrawingIcon; connected: boolean }[];
}) {
  const count = services.length;
  // The tile and the column of boxes share a middle.
  const boxesSpan = CONNECT_BOX.step * (count - 1) + CONNECT_BOX.size;
  const span = Math.max(boxesSpan, CONNECT_TILE);
  const boxesTop = 1 + (span - boxesSpan) / 2;
  const tileY = 1 + (span - CONNECT_TILE) / 2;
  const middle = 1 + span / 2;
  return (
    <ArtCanvas
      width={200}
      height={span + 2}
      foot={span + 1}
      label={`Your Tlonbot with a line to each service: dashed until you connect it, then solid. ${
        services.filter((service) => service.connected).length
      } of ${count} connected.`}
    >
      <ArtSvg>
        <BotTile glyph={glyph} x={1} y={tileY} size={CONNECT_TILE} />
        {services.map((service, index) => {
          const y = boxesTop + CONNECT_BOX.step * index;
          const from = middle + 16 * (index - (count - 1) / 2);
          const to = y + CONNECT_BOX.size / 2;
          const d =
            from === to ? `M73 ${from}L153 ${to}` : `M73 ${from}H113V${to}H153`;
          return (
            <G key={index}>
              <ArtBox
                x={CONNECT_BOX.x}
                y={y}
                width={CONNECT_BOX.size}
                height={CONNECT_BOX.size}
                radius={12}
              />
              <ServiceIcon icon={service.icon} y={y} />
              {service.connected ? (
                <>
                  <ArtLine d={d} />
                  <ArtBox
                    x={CONNECT_BOX.x + 3}
                    y={y + 3}
                    width={CONNECT_BOX.size - 6}
                    height={CONNECT_BOX.size - 6}
                    radius={INNER_OUTLINE_RADIUS}
                    fill="none"
                  />
                </>
              ) : (
                <MarchingPath d={d} />
              )}
            </G>
          );
        })}
      </ArtSvg>
    </ArtCanvas>
  );
}

/** A service's picture inside its 40-unit tile, whose top is at `y`. */
function ServiceIcon({ icon, y }: { icon: ServiceDrawingIcon; y: number }) {
  const { ink } = useLineColors();
  switch (icon) {
    case 'calendar':
      return (
        <>
          <ArtBox x={170} y={y + 13} width={18} height={16} radius={5} />
          <ArtLine
            d={`M170 ${y + 18}L188 ${y + 18}M174.5 ${y + 10}L174.5 ${y + 15}M183.5 ${y + 10}L183.5 ${y + 15}`}
          />
          <ArtBox x={181} y={y + 22} width={4} height={4} fill={ink} />
        </>
      );
    case 'mail':
      return (
        <>
          <ArtBox x={169} y={y + 13} width={20} height={14} radius={5} />
          <ArtLine d={`M169 ${y + 13}L179 ${y + 21}L189 ${y + 13}`} />
        </>
      );
    case 'branch':
      return (
        <>
          <ArtLine
            d={`${circle(174, y + 13, 2.2)}${circle(174, y + 27, 2.2)}${circle(184, y + 17, 2.2)}M174 ${y + 15.2}L174 ${y + 24.8}M184 ${y + 19.2}C184 ${y + 23} 174 ${y + 21} 174 ${y + 24}`}
          />
        </>
      );
    case 'page':
      return (
        <>
          <ArtBox x={171} y={y + 10} width={16} height={20} radius={5} />
          <ArtLine
            d={`M175 ${y + 16}L183 ${y + 16}M175 ${y + 20}L183 ${y + 20}M175 ${y + 24}L180 ${y + 24}`}
          />
        </>
      );
  }
}

/** What a way to get a model on You choose the model shows. */
export type ModelDrawingKind = 'included' | 'subscription' | 'apiKey';

const MODEL_TILE = { y: 101, size: 44, step: 121 };

/**
 * You choose the model: arrows down from the Tlonbot to a tile per way to
 * get a model, solid to your pick, which gets a second outline.
 */
export function ModelArt({
  glyph,
  choices,
}: {
  glyph: AvatarGlyphId;
  /** One entry per row, in list order. */
  choices: { kind: ModelDrawingKind; picked: boolean }[];
}) {
  const count = choices.length;
  const left = 144 - MODEL_TILE.size / 2 - (MODEL_TILE.step * (count - 1)) / 2;
  return (
    <ArtCanvas
      width={288}
      height={MODEL_TILE.y + MODEL_TILE.size + 1}
      foot={MODEL_TILE.y + MODEL_TILE.size}
      label="Your Tlonbot with an arrow to each way to get a model, solid to the one you pick"
    >
      <ArtSvg>
        <BotTile glyph={glyph} x={116} y={1} size={56} />
        {choices.map((choice, index) => {
          const x = left + MODEL_TILE.step * index;
          const center = x + MODEL_TILE.size / 2;
          const start = 144 + 14 * (index - (count - 1) / 2);
          return (
            <G key={index}>
              <ArtBox
                x={x}
                y={MODEL_TILE.y}
                width={MODEL_TILE.size}
                height={MODEL_TILE.size}
                radius={12}
              />
              <ModelIcon kind={choice.kind} x={x} />
              {choice.picked ? (
                <ArtBox
                  x={x + 3}
                  y={MODEL_TILE.y + 3}
                  width={MODEL_TILE.size - 6}
                  height={MODEL_TILE.size - 6}
                  radius={INNER_OUTLINE_RADIUS}
                  fill="none"
                />
              ) : null}
              <ArtArrow
                via={
                  start === center
                    ? undefined
                    : [
                        [start, 80],
                        [center, 80],
                      ]
                }
                from={[start, 65]}
                to={[center, MODEL_TILE.y - 6]}
                dashed={!choice.picked}
              />
            </G>
          );
        })}
      </ArtSvg>
    </ArtCanvas>
  );
}

/** A way to get a model, drawn inside its 44-unit tile, whose left is `x`. */
function ModelIcon({ kind, x }: { kind: ModelDrawingKind; x: number }) {
  const y = MODEL_TILE.y;
  switch (kind) {
    case 'included': {
      const cx = x + 22;
      const cy = y + 22;
      return (
        <ArtLine
          d={`M${cx} ${cy - 10}Q${cx} ${cy} ${cx + 10} ${cy}Q${cx} ${cy} ${cx} ${cy + 10}Q${cx} ${cy} ${cx - 10} ${cy}Q${cx} ${cy} ${cx} ${cy - 10}Z`}
        />
      );
    }
    case 'subscription':
      return (
        <>
          <ArtBox
            x={x + 11}
            y={y + 14.5}
            width={22}
            height={15}
            radius={5}
            fill="none"
          />
          <ArtLine
            d={`M${x + 11} ${y + 19}L${x + 33} ${y + 19}M${x + 15} ${y + 25.5}L${x + 21} ${y + 25.5}`}
          />
        </>
      );
    case 'apiKey':
      return (
        <ArtLine
          d={`${circle(x + 15, y + 22, 5)}M${x + 20} ${y + 22}L${x + 34} ${y + 22}M${x + 29} ${y + 22}L${x + 29} ${y + 26.5}M${x + 34} ${y + 22}L${x + 34} ${y + 28}`}
        />
      );
  }
}

const CHAT_BUBBLES = [
  { x: 21, y: 27 },
  { x: 45, y: 52.33 },
  { x: 21, y: 77.67 },
  { x: 45, y: 103 },
];
const SHARED_FILES = [149, 185, 221];

/**
 * Bring your friends: a workspace in three panels, a chat, a row of shared
 * files, and under them the Tlonbot, a friend and an open seat.
 */
export function WorkspaceArt({ glyph }: { glyph: AvatarGlyphId }) {
  return (
    <ArtCanvas
      width={266}
      height={146}
      foot={145}
      label="A workspace in three panels: a chat, a row of shared files, and below them your Tlonbot, a friend and an open seat"
    >
      <ArtSvg>
        <ArtBox x={1} y={1} width={264} height={144} radius={16} />
        <ArtBox x={9} y={9} width={120} height={128} radius={16} fill="none" />
        <ArtBox x={137} y={9} width={120} height={60} radius={12} fill="none" />
        <ArtBox
          x={137}
          y={77}
          width={120}
          height={60}
          radius={12}
          fill="none"
        />
        {SHARED_FILES.map((x) => (
          <HatchedBox key={x} x={x} y={27} width={24} height={24} radius={5} />
        ))}
        {CHAT_BUBBLES.map(({ x, y }) => (
          <G key={y}>
            <ArtBox x={x} y={y} width={72} height={16} radius={5} />
            <ArtLine d={`M${x + 6} ${y + 8}L${x + 66} ${y + 8}`} />
          </G>
        ))}
        <BotTile
          glyph={glyph}
          x={149}
          y={95}
          size={24}
          radius={5}
          glyphSize={17}
          glyphLineWidth={0.75}
        />
        <ArtBox x={185} y={95} width={24} height={24} radius={5} fill="none" />
        <ArtLine d={`${circle(197, 102, 3)}M191 114A6 6 0 0 1 203 114`} />
        <ArtBox
          x={221}
          y={95}
          width={24}
          height={24}
          radius={5}
          fill="none"
          dash={[3, 2]}
        />
        <ArtLine d="M229 107L237 107M233 103L233 111" />
      </ArtSvg>
    </ArtCanvas>
  );
}

/** A circle as path data, so it can share a path with other lines. */
function circle(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
}
