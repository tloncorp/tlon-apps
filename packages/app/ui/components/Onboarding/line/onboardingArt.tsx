import Svg, { Rect } from 'react-native-svg';

import type { AvatarGlyphId } from './avatarGlyphs';
import {
  ArtArrow,
  ArtBox,
  ArtCanvas,
  ArtLabel,
  ArtLine,
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

/** Setting up: your computer's walls, and the Tlonbot still in dashes. */
export function SetupArt({ glyph }: { glyph: AvatarGlyphId }) {
  return (
    <ArtCanvas
      width={242}
      height={242}
      label="Your Tlon computer, with your Tlonbot inside it, still being set up"
    >
      <Svg width={242} height={242}>
        <HatchedBox x={1} y={1} width={240} height={240} />
        <ArtBox x={19} y={19} width={204} height={204} />
        <MarchingBox x={69} y={69} width={104} height={104} />
        <GlyphMark glyph={glyph} x={88.5} y={88.5} size={65} variant="dashed" />
      </Svg>
    </ArtCanvas>
  );
}

/** Meet your Tlonbot: it reaches your chats, friends and apps; you hold it. */
export function MeetArt({ glyph }: { glyph: AvatarGlyphId }) {
  const boxes = [
    { y: 1, label: 'YOUR CHATS', from: [127, 71], to: [189, 24] },
    { y: 91, label: 'YOUR FRIENDS', from: [127, 107], to: [189, 114] },
    { y: 181, label: 'YOUR APPS', from: [127, 143], to: [189, 204] },
  ] as const;
  return (
    <ArtCanvas
      width={346}
      height={266}
      label="Your Tlonbot, with lines out to your chats, your friends and your apps, and a line down to you"
    >
      <Svg width={346} height={266}>
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
        <Packet x={125} y={105} dx={57} dy={6.4} delayMs={1100} />
        <Packet x={125} y={141} dx={58.4} dy={57.5} delayMs={1300} />
      </Svg>
      {boxes.map((box) => (
        <ArtLabel key={box.label} x={209} y={box.y + 27}>
          {box.label}
        </ArtLabel>
      ))}
      <ArtLabel x={1} y={189}>
        TLONBOT
      </ArtLabel>
      <ArtLabel x={57} y={263}>
        YOU
      </ArtLabel>
    </ArtCanvas>
  );
}

/** Yours to keep: the Tlonbot inside walls that only you reach. */
export function PrivateArt({ glyph }: { glyph: AvatarGlyphId }) {
  return (
    <ArtCanvas
      width={184}
      height={258}
      label="Your Tlonbot inside your computer's walls, with only you reaching it"
    >
      <Svg width={184} height={258}>
        <HatchedBox x={0.74} y={26} width={182.52} height={182.52} />
        <ArtBox x={31.94} y={57.2} width={120.12} height={120.12} />
        <BotTile
          glyph={glyph}
          x={57.68}
          y={82.94}
          size={68.64}
          glyphLineWidth={1.25}
        />
        <PulseRing x={53.78} y={79.04} size={76.44} />
        <YouMark x={88} y={246.5} />
        <ArtArrow from={[92, 242.5]} to={[92, 214.5]} />
        <Packet x={90} y={240.5} dx={0} dy={-86.9} durationMs={3600} />
      </Svg>
      <ArtLabel x={0.7} y={12}>
        YOUR COMPUTER
      </ArtLabel>
      <ArtLabel x={104} y={254.5}>
        ONLY YOU
      </ArtLabel>
    </ArtCanvas>
  );
}

const CONNECT_CENTER_Y = 33;

/** Connect your services: one line per service, solid once it's connected. */
export function ConnectArt({
  glyph,
  connected,
}: {
  glyph: AvatarGlyphId;
  /** One entry per featured service, in list order. */
  connected: boolean[];
}) {
  const count = connected.length;
  return (
    <ArtCanvas
      width={200}
      height={86}
      label={`Your Tlonbot with a line to each service: dashed until you connect it, then solid. ${
        connected.filter(Boolean).length
      } of ${count} connected.`}
    >
      <Svg width={200} height={86}>
        <BotTile glyph={glyph} x={1} y={1} size={64} />
        {connected.map((on, index) => {
          const offset = index - (count - 1) / 2;
          return (
            <PortLine
              key={index}
              from={[73, CONNECT_CENTER_Y + 12 * offset]}
              to={[195, CONNECT_CENTER_Y + 28 * offset]}
              on={on}
            />
          );
        })}
      </Svg>
      <ArtLabel x={1} y={83}>
        TLONBOT
      </ArtLabel>
    </ArtCanvas>
  );
}

/** You choose the model: one line per way to get one, solid to your pick. */
export function ModelArt({
  glyph,
  picked,
}: {
  glyph: AvatarGlyphId;
  /** One entry per row, in list order. */
  picked: boolean[];
}) {
  const count = picked.length;
  return (
    <ArtCanvas
      width={252}
      height={100}
      label="Your Tlonbot with a line down to each way to get a model, solid to the one you pick"
    >
      <Svg width={252} height={100}>
        <BotTile glyph={glyph} x={98} y={1} size={56} />
        {picked.map((on, index) => (
          <PortLine
            key={index}
            from={[126, 65]}
            to={[126 + 121 * (index - (count - 1) / 2), 95]}
            on={on}
          />
        ))}
      </Svg>
    </ArtCanvas>
  );
}

/**
 * Start a workspace: a plan of the home group, its chat and its Updates
 * notebook, with the Tlonbot and you inside and your friends at the door.
 */
export function WorkspaceArt({ glyph }: { glyph: AvatarGlyphId }) {
  const { paper } = useLineColors();
  const notes = [59, 107];
  return (
    <ArtCanvas
      width={356}
      height={264}
      label="A plan of your workspace: a chat with your Tlonbot and you, an Updates notebook, and your friends waiting at the door"
    >
      <Svg width={356} height={264}>
        <ArtBox x={1} y={1} width={354} height={210} fill="none" />
        <ArtBox x={6} y={6} width={344} height={200} fill="none" />
        <Rect x={223} y={203} width={60} height={10} fill={paper} />
        <ArtLine d="M223 205L223 211" />
        <ArtLine d="M283 205L283 211" />
        <ArtLine d="M175 7L175 127" />
        <ArtLine d="M181 7L181 127" />
        <ArtLine d="M175 127L181 127" />
        <TypedLine x1={23} x2={135} y={58} />
        <TypedLine x1={23} x2={101} y={82} delayMs={600} />
        <TypedLine x1={63} x2={159} y={106} delayMs={1200} />
        {notes.map((y) => (
          <ArtBox key={`card-${y}`} x={201} y={y} width={122} height={38} />
        ))}
        {notes.map((y) => (
          <ArtLine key={`title-${y}`} d={`M209 ${y + 13}L251 ${y + 13}`} />
        ))}
        {notes.map((y) => (
          <ArtLine key={`body-${y}`} d={`M209 ${y + 25}L311 ${y + 25}`} />
        ))}
        <BotTile glyph={glyph} x={27} y={133} size={52} />
        <YouMark x={242} y={162} />
        <MarchingBox x={229} y={241} width={22} height={22} dash={[3, 3]} />
        <MarchingBox x={261} y={241} width={22} height={22} dash={[3, 3]} />
        <MarchingPath d="M253 213L253 233" dash={[3, 3]} reverse />
      </Svg>
      <ArtLabel x={21} y={33}>
        # CHAT
      </ArtLabel>
      <ArtLabel x={199} y={33}>
        UPDATES
      </ArtLabel>
      <ArtLabel x={91} y={165}>
        TLONBOT
      </ArtLabel>
      <ArtLabel x={267} y={172}>
        YOU
      </ArtLabel>
      <ArtLabel x={221} y={256} anchor="end">
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
      height={119}
      label={`Direct messages, mentions and workspace posts, each wired to your phone. ${
        on.length
          ? `Getting through: ${on.join(', ')}.`
          : 'Nothing gets through.'
      }`}
    >
      <Svg width={240} height={119}>
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
      </Svg>
      {NOTIFICATION_SOURCES.map((source, index) => (
        <ArtLabel key={source} x={71} y={21 + 28 * index} anchor="end">
          {source}
        </ArtLabel>
      ))}
      <ArtLabel x={197} y={117} anchor="middle">
        YOUR PHONE
      </ArtLabel>
    </ArtCanvas>
  );
}

/**
 * Allow notifications: the system prompt in lines, with an arrow from you to
 * Allow. iOS puts Allow on the right of two halves; Android stacks it above
 * Don't allow, so there the arrow comes in from the side.
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
        <Svg width={300} height={160}>
          <ArtBox x={64} y={1} width={234} height={158} />
          <ArtLine d="M64 69L298 69" />
          <ArtLine d="M64 113L298 113" />
          <YouMark x={28} y={87} />
          <ArtArrow from={[40, 91]} to={[104, 91]} />
        </Svg>
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
      width={272}
      height={200}
      label="The notification prompt drawn in lines, with an arrow from you to Allow"
    >
      <Svg width={272} height={200}>
        <ArtBox x={1} y={1} width={270} height={144} />
        <ArtLine d="M41 69L231 69" />
        <ArtLine d="M71 81L201 81" />
        <ArtLine d="M1 101L271 101" />
        <ArtLine d="M136 101L136 145" />
        <ArtArrow from={[203.5, 187]} to={[203.5, 134]} />
        <YouMark x={199.5} y={191} />
      </Svg>
      <ArtLabel x={136} y={31} anchor="middle">
        “TLON” WOULD LIKE TO
      </ArtLabel>
      <ArtLabel x={136} y={49} anchor="middle">
        SEND YOU NOTIFICATIONS
      </ArtLabel>
      <ArtLabel x={68.5} y={127} anchor="middle">
        DON’T ALLOW
      </ArtLabel>
      <ArtLabel x={203.5} y={127} anchor="middle">
        ALLOW
      </ArtLabel>
      <ArtLabel x={217.5} y={199}>
        YOU
      </ArtLabel>
    </ArtCanvas>
  );
}
