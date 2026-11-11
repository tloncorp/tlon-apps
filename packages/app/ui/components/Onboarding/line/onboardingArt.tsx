import { G, Rect } from 'react-native-svg';

import type { AvatarGlyphId } from './avatarGlyphs';
import {
  ArtArrow,
  ArtBox,
  ArtCanvas,
  ArtLabel,
  ArtLine,
  ArtSvg,
  BotTile,
  GlyphMark,
  HatchedBox,
  MarchingBox,
  MarchingPath,
  Packet,
  PortLine,
  PulseRing,
  TypedLine,
  YouMark,
  useLineColors,
} from './lineKit';

// Each drawing is traced from its board on the onboarding design canvas, in a
// box cropped to its ink, so the screens can space it from the list under it.
// The ones with no card under them are drawn smaller than traced, by `scale`,
// and each ends on an edge of its own, a box's bottom line.

/** Setting up: your computer's walls, and the Tlonbot still in dashes. */
export function SetupArt({ glyph }: { glyph: AvatarGlyphId }) {
  return (
    <ArtCanvas
      width={242}
      height={242}
      scale={0.8}
      foot={241}
      label="Your Tlon computer, with your Tlonbot inside it, still being set up"
    >
      <ArtSvg>
        <HatchedBox x={1} y={1} width={240} height={240} />
        <ArtBox x={19} y={19} width={204} height={204} />
        <MarchingBox x={69} y={69} width={104} height={104} />
        <GlyphMark glyph={glyph} x={88.5} y={88.5} size={65} variant="dashed" />
      </ArtSvg>
    </ArtCanvas>
  );
}

/** Meet your Tlonbot: it reaches your chats, friends and apps; you hold it. */
export function MeetArt({ glyph }: { glyph: AvatarGlyphId }) {
  // YOUR APPS ends level with the YOU marker, so the drawing has a floor.
  const boxes = [
    { y: 1, label: 'YOUR CHATS', from: [127, 71], to: [189, 24] },
    { y: 108.5, label: 'YOUR FRIENDS', from: [127, 107], to: [189, 131.5] },
    { y: 216, label: 'YOUR APPS', from: [127, 143], to: [189, 239] },
  ] as const;
  return (
    <ArtCanvas
      width={346}
      height={265}
      scale={0.85}
      label="Your Tlonbot, with lines out to your chats, your friends and your apps, and a line down to you"
    >
      <ArtSvg>
        {boxes.map((box) => (
          <ArtBox key={box.label} x={195} y={box.y} width={150} height={46} />
        ))}
        {boxes.map((box) => (
          <ArtArrow key={box.label} from={[...box.from]} to={[...box.to]} />
        ))}
        <BotTile glyph={glyph} x={1} y={49} size={116} />
        <ArtLine d="M35 201L35 247" />
        <YouMark x={31} y={254} />
        <Packet x={33} y={245} dx={0} dy={-46} />
        <Packet x={125} y={69} dx={58} dy={-44} delayMs={900} />
        <Packet x={125} y={105} dx={57.3} dy={22.7} delayMs={1100} />
        <Packet x={125} y={141} dx={59.3} dy={91.8} delayMs={1300} />
      </ArtSvg>
      {boxes.map((box) => (
        <ArtLabel key={box.label} x={209} y={box.y + 27}>
          {box.label}
        </ArtLabel>
      ))}
      <ArtLabel x={1} y={189}>
        TLONBOT
      </ArtLabel>
      <ArtLabel x={57} y={262}>
        YOU
      </ArtLabel>
    </ArtCanvas>
  );
}

/** Yours to keep: the Tlonbot inside walls that only you reach. */
export function PrivateArt({ glyph }: { glyph: AvatarGlyphId }) {
  return (
    <ArtCanvas
      // x 148 sits at the screen's middle: the walls a little left of it,
      // you on their right.
      width={404}
      height={261}
      foot={260}
      originX={-54}
      scale={0.7}
      label="Your Tlonbot inside your computer's walls, with only you reaching it"
    >
      <ArtSvg>
        <HatchedBox x={1} y={26} width={234} height={234} />
        <ArtBox x={41} y={66} width={154} height={154} />
        <BotTile glyph={glyph} x={74} y={99} size={88} />
        <PulseRing x={69} y={94} size={98} />
        <YouMark x={269} y={139} />
        <ArtArrow from={[265, 143]} to={[239, 143]} />
        <Packet x={261} y={141} dx={-99} dy={0} durationMs={3600} />
      </ArtSvg>
      <ArtLabel x={1} y={12}>
        YOUR COMPUTER
      </ArtLabel>
      <ArtLabel x={269} y={131}>
        ONLY YOU
      </ArtLabel>
    </ArtCanvas>
  );
}

/** Where the Tlonbot's tile is on Connect your services, and its middle. */
const CONNECT_TILE = { x: 1, y: 15, size: 64 };
const CONNECT_BOX = { x: 193, width: 130, height: 32, step: 40 };

/**
 * Connect your services: a labeled box per service with a line to it from
 * the Tlonbot, marching until it's connected, then solid, and the box gets a
 * second outline.
 */
export function ConnectArt({
  glyph,
  services,
}: {
  glyph: AvatarGlyphId;
  /** One entry per featured service, in list order. */
  services: { label: string; connected: boolean }[];
}) {
  const count = services.length;
  const middle = CONNECT_TILE.y + CONNECT_TILE.size / 2;
  const lastBoxEnd = 1 + CONNECT_BOX.step * (count - 1) + CONNECT_BOX.height;
  // The drawing ends at its last box, or the TLONBOT caption's baseline.
  const foot = Math.max(lastBoxEnd, 97);
  return (
    <ArtCanvas
      width={324}
      height={Math.max(lastBoxEnd + 1, foot)}
      foot={foot}
      label={`Your Tlonbot with a line to each service: dashed until you connect it, then solid. ${
        services.filter((service) => service.connected).length
      } of ${count} connected.`}
    >
      <ArtSvg>
        <BotTile
          glyph={glyph}
          x={CONNECT_TILE.x}
          y={CONNECT_TILE.y}
          size={CONNECT_TILE.size}
        />
        {services.map((service, index) => {
          const top = 1 + CONNECT_BOX.step * index;
          const d = `M73 ${middle + 16 * (index - (count - 1) / 2)}L${
            CONNECT_BOX.x - 6
          } ${top + CONNECT_BOX.height / 2}`;
          return (
            <G key={index}>
              <ArtBox
                x={CONNECT_BOX.x}
                y={top}
                width={CONNECT_BOX.width}
                height={CONNECT_BOX.height}
              />
              {service.connected ? (
                <>
                  <ArtLine d={d} />
                  <ArtBox
                    x={CONNECT_BOX.x + 3}
                    y={top + 3}
                    width={CONNECT_BOX.width - 6}
                    height={CONNECT_BOX.height - 6}
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
      <ArtLabel x={1} y={97}>
        TLONBOT
      </ArtLabel>
      {services.map((service, index) => (
        <ArtLabel
          key={index}
          x={CONNECT_BOX.x + 12}
          y={21 + CONNECT_BOX.step * index}
        >
          {service.label}
        </ArtLabel>
      ))}
    </ArtCanvas>
  );
}

const MODEL_BOX = { y: 99, width: 112, height: 44, gap: 9 };

/**
 * You choose the model: a labeled box per way to get one, with an arrow to
 * each from the Tlonbot, solid to your pick, which gets a second outline.
 */
export function ModelArt({
  glyph,
  choices,
}: {
  glyph: AvatarGlyphId;
  /** One entry per row, in list order: the box's two caption lines. */
  choices: { label: [string, string]; picked: boolean }[];
}) {
  const count = choices.length;
  const span = count * MODEL_BOX.width + (count - 1) * MODEL_BOX.gap;
  const left = 178 - span / 2;
  const boxX = (index: number) =>
    left + index * (MODEL_BOX.width + MODEL_BOX.gap);
  return (
    <ArtCanvas
      width={356}
      height={MODEL_BOX.y + MODEL_BOX.height + 1}
      foot={MODEL_BOX.y + MODEL_BOX.height}
      label="Your Tlonbot with an arrow to each way to get a model, solid to the one you pick"
    >
      <ArtSvg>
        <BotTile glyph={glyph} x={150} y={1} size={56} />
        {choices.map((choice, index) => {
          const x = boxX(index);
          return (
            <G key={index}>
              <ArtBox
                x={x}
                y={MODEL_BOX.y}
                width={MODEL_BOX.width}
                height={MODEL_BOX.height}
              />
              {choice.picked ? (
                <ArtBox
                  x={x + 3}
                  y={MODEL_BOX.y + 3}
                  width={MODEL_BOX.width - 6}
                  height={MODEL_BOX.height - 6}
                  fill="none"
                />
              ) : null}
              <ArtArrow
                from={[178, 65]}
                to={[x + MODEL_BOX.width / 2, MODEL_BOX.y - 6]}
                dashed={!choice.picked}
              />
            </G>
          );
        })}
      </ArtSvg>
      {choices.map((choice, index) =>
        choice.label.map((line, row) => (
          <ArtLabel
            key={`${index}-${row}`}
            x={boxX(index) + 12}
            y={MODEL_BOX.y + 19 + 16 * row}
          >
            {line}
          </ArtLabel>
        ))
      )}
    </ArtCanvas>
  );
}

/**
 * Start a workspace: a plan of the home group, its chat and its Updates
 * notebook, with the Tlonbot and you inside and your friends at the door.
 */
export function WorkspaceArt({ glyph }: { glyph: AvatarGlyphId }) {
  const { paper } = useLineColors();
  const notes = [111, 159];
  // The door is in the top wall, with your friends above it, so the plan's
  // double wall is the drawing's bottom edge.
  return (
    <ArtCanvas
      width={356}
      height={264}
      scale={0.85}
      foot={263}
      label="A plan of your workspace: a chat with your Tlonbot and you, an Updates notebook, and your friends waiting at the door"
    >
      <ArtSvg>
        <ArtBox x={1} y={53} width={354} height={210} fill="none" />
        <ArtBox x={6} y={58} width={344} height={200} fill="none" />
        <Rect x={223} y={51} width={60} height={10} fill={paper} />
        <ArtLine d="M223 53L223 59" />
        <ArtLine d="M283 53L283 59" />
        <ArtLine d="M175 59L175 179" />
        <ArtLine d="M181 59L181 179" />
        <ArtLine d="M175 179L181 179" />
        <TypedLine x1={23} x2={135} y={110} />
        <TypedLine x1={23} x2={101} y={134} delayMs={600} />
        <TypedLine x1={63} x2={159} y={158} delayMs={1200} />
        {notes.map((y) => (
          <ArtBox key={`card-${y}`} x={201} y={y} width={122} height={38} />
        ))}
        {notes.map((y) => (
          <ArtLine key={`title-${y}`} d={`M209 ${y + 13}L251 ${y + 13}`} />
        ))}
        {notes.map((y) => (
          <ArtLine key={`body-${y}`} d={`M209 ${y + 25}L311 ${y + 25}`} />
        ))}
        <BotTile glyph={glyph} x={27} y={185} size={52} />
        <YouMark x={242} y={214} />
        <MarchingBox x={229} y={1} width={22} height={22} dash={[3, 3]} />
        <MarchingBox x={261} y={1} width={22} height={22} dash={[3, 3]} />
        <MarchingPath d="M253 51L253 31" dash={[3, 3]} reverse />
      </ArtSvg>
      <ArtLabel x={21} y={85}>
        # CHAT
      </ArtLabel>
      <ArtLabel x={199} y={85}>
        UPDATES
      </ArtLabel>
      <ArtLabel x={91} y={217}>
        TLONBOT
      </ArtLabel>
      <ArtLabel x={267} y={224}>
        YOU
      </ArtLabel>
      <ArtLabel x={221} y={16} anchor="end">
        YOUR FRIENDS
      </ArtLabel>
    </ArtCanvas>
  );
}

/** What each notification level lets through to your phone, in list order. */
export const NOTIFICATION_SOURCES = ['DMS', 'MENTIONS', 'POSTS'] as const;

/**
 * Notifications: DMs, mentions and posts each wired to your phone, solid for
 * the ones the picked level lets through and marching dashes for the rest.
 */
export function NotificationsArt({
  through,
}: {
  /** One entry per source in NOTIFICATION_SOURCES. */
  through: boolean[];
}) {
  const names = ['direct messages', 'mentions', 'workspace posts'];
  const on = names.filter((_, index) => through[index]);
  return (
    <ArtCanvas
      width={240}
      // To YOUR PHONE's baseline, which the list spaces from.
      height={115}
      label={`Direct messages, mentions and workspace posts, each wired to your phone. ${
        on.length
          ? `Getting through: ${on.join(', ')}.`
          : 'Nothing gets through.'
      }`}
    >
      <ArtSvg>
        <ArtBox x={169} y={1} width={56} height={96} />
        <ArtLine d="M189 10L205 10" />
        {NOTIFICATION_SOURCES.map((_, index) => (
          <PortLine
            key={index}
            from={[166, 37 + 12 * index]}
            to={[83, 17 + 28 * index]}
            on={!!through[index]}
            reverse
          />
        ))}
      </ArtSvg>
      {NOTIFICATION_SOURCES.map((source, index) => (
        <ArtLabel key={source} x={71} y={21 + 28 * index} anchor="end">
          {source}
        </ArtLabel>
      ))}
      <ArtLabel x={197} y={115} anchor="middle">
        YOUR PHONE
      </ArtLabel>
    </ArtCanvas>
  );
}

/**
 * Allow notifications: the system prompt in lines, with an arrow from you,
 * beside it, to Allow. iOS puts Allow on the right of two halves and Android
 * stacks it above Don't allow; either way the arrow comes in at its row.
 */
export function AllowNotificationsArt({
  platform,
}: {
  platform: 'ios' | 'android';
}) {
  if (platform === 'android') {
    return (
      <ArtCanvas
        width={300}
        height={160}
        label="The notification prompt drawn in lines, with an arrow from you to Allow"
      >
        <ArtSvg>
          <ArtBox x={64} y={1} width={234} height={158} />
          <ArtLine d="M64 69L298 69" />
          <ArtLine d="M64 113L298 113" />
          <YouMark x={28} y={87} />
          <ArtArrow from={[40, 91]} to={[104, 91]} />
        </ArtSvg>
        <ArtLabel x={181} y={31} anchor="middle">
          ALLOW TLON TO SEND YOU
        </ArtLabel>
        <ArtLabel x={181} y={49} anchor="middle">
          NOTIFICATIONS?
        </ArtLabel>
        <ArtLabel x={181} y={95} anchor="middle">
          ALLOW
        </ArtLabel>
        <ArtLabel x={181} y={140} anchor="middle">
          DON’T ALLOW
        </ArtLabel>
        <ArtLabel x={24} y={95} anchor="end">
          YOU
        </ArtLabel>
      </ArtCanvas>
    );
  }
  return (
    <ArtCanvas
      // Centered on x 170: the prompt sits left of the screen's middle with
      // you beside it, and its bottom is the drawing's edge.
      width={338}
      height={146}
      foot={145}
      originX={0.95}
      label="The notification prompt drawn in lines, with an arrow from you, beside it, to Allow"
    >
      <ArtSvg>
        <ArtBox x={1} y={1} width={270} height={144} />
        <ArtLine d="M41 69L231 69" />
        <ArtLine d="M71 81L201 81" />
        <ArtLine d="M1 101L271 101" />
        <ArtLine d="M136 101L136 145" />
        <ArtArrow from={[297, 123]} to={[275, 123]} />
        <YouMark x={301} y={119} />
      </ArtSvg>
      <ArtLabel x={136} y={31} anchor="middle">
        “TLON” WOULD LIKE TO
      </ArtLabel>
      <ArtLabel x={136} y={48} anchor="middle">
        SEND YOU NOTIFICATIONS
      </ArtLabel>
      <ArtLabel x={68.5} y={127} anchor="middle">
        DON’T ALLOW
      </ArtLabel>
      <ArtLabel x={203.5} y={127} anchor="middle">
        ALLOW
      </ArtLabel>
      <ArtLabel x={317} y={127}>
        YOU
      </ArtLabel>
    </ArtCanvas>
  );
}
