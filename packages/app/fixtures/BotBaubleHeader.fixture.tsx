import { type PresenceStatus, serializeComputingStatus } from '@tloncorp/api';
import type * as db from '@tloncorp/shared/db';
import {
  clearPresenceState,
  handlePresenceEvent,
} from '@tloncorp/shared/store';
import { useEffect, useMemo, useState } from 'react';

import { setEnabled } from '../lib/featureFlags';
import { Channel } from '../ui';
import { ChannelFixtureWrapper, baseProps } from './Channel.fixture';
import { makePost, verse } from './contentHelpers';
import { claimBotContact, initialContacts, tlonLocalIntros } from './fakeData';

type Phase =
  | { state: 'idle' }
  | { state: 'thinking' }
  | { state: 'working'; tools: { toolName: string; label: string }[] }
  | { state: 'offline' };

const bot = claimBotContact;
const channel: db.Channel = {
  ...tlonLocalIntros,
  id: bot.id,
  type: 'dm',
  groupId: null,
  title: null,
  description: null,
  contactId: bot.id,
  members: [
    { chatId: bot.id, contactId: bot.id, membershipType: 'channel' },
    { chatId: bot.id, contactId: '~zod', membershipType: 'channel' },
  ] as db.ChatMember[],
};

// Enough earlier history to scroll the header into its pill.
const history: [db.Contact | 'me', string][] = Array.from(
  { length: 12 },
  (_, index) =>
    index % 2 === 0
      ? ['me', `Earlier question number ${index / 2 + 1}`]
      : [bot, `An earlier answer, the ${(index + 1) / 2}th of the morning.`]
);
const lines: [db.Contact | 'me', string][] = [
  ...history,
  ['me', 'Can you pull together the notes from yesterday?'],
  [bot, 'Sure. I found three docs from the design call.'],
  ['me', 'Great, summarize the decisions please'],
  [bot, 'Decisions: ship the bauble for bots, keep the palette, no bold.'],
  ['me', 'And what is left to do?'],
  [bot, 'Two things: the motion pass and a dark mode check.'],
  ['me', 'Ok. Check the calendar for Thursday too'],
];
const me = initialContacts.find((contact) => contact.id === '~zod') ?? {
  ...bot,
  id: '~zod',
  nickname: null,
  botInfo: null,
};
const posts = lines
  .map(([author, text], index) =>
    makePost(author === 'me' ? me : author, [verse.inline(text)], {
      id: `bauble-${index}`,
      channelId: channel.id,
      groupId: null,
      replyCount: 0,
      sentAt: Date.now() - (lines.length - index) * 60_000,
      receivedAt: Date.now() - (lines.length - index) * 60_000,
    })
  )
  .reverse();

function computing(tools: { toolName: string; label: string }[] = []) {
  const status: PresenceStatus = {
    key: { context: `/dm/${bot.id}`, ship: bot.id, topic: 'computing' },
    timing: { since: Date.now(), timeout: '~m1' },
    display: {
      icon: null,
      text: null,
      blob: serializeComputingStatus({ thinking: true, toolCalls: tools }),
    },
    contextId: channel.id,
  };
  return status;
}

function applyPhase(phase: Phase) {
  if (phase.state === 'thinking') {
    handlePresenceEvent({ type: 'set', state: computing() });
  } else if (phase.state === 'working') {
    handlePresenceEvent({ type: 'set', state: computing(phase.tools) });
  } else {
    clearPresenceState();
  }
}

const cycle: { phase: Phase; ms: number }[] = [
  { phase: { state: 'idle' }, ms: 5000 },
  { phase: { state: 'thinking' }, ms: 5000 },
  {
    phase: {
      state: 'working',
      tools: [{ toolName: 'calendar', label: 'Checking the calendar' }],
    },
    ms: 2400,
  },
  {
    phase: {
      state: 'working',
      tools: [{ toolName: 'web_fetch', label: 'Checking the web' }],
    },
    ms: 2400,
  },
  {
    phase: {
      state: 'working',
      tools: [{ toolName: 'read', label: 'Reading files' }],
    },
    ms: 2400,
  },
  { phase: { state: 'idle' }, ms: 5000 },
  { phase: { state: 'offline' }, ms: 5000 },
];

function BotBaubleFixture({
  phase: fixedPhase,
  theme,
}: {
  phase?: Phase;
  theme?: 'light' | 'dark';
}) {
  const [index, setIndex] = useState(0);
  const phase = fixedPhase ?? cycle[index].phase;

  useEffect(() => {
    setEnabled('botBaubleHeader', true);
    return () => {
      setEnabled('botBaubleHeader', false);
      clearPresenceState();
    };
  }, []);

  useEffect(() => {
    if (fixedPhase) return;
    const timeout = setTimeout(
      () => setIndex((current) => (current + 1) % cycle.length),
      cycle[index].ms
    );
    return () => clearTimeout(timeout);
  }, [fixedPhase, index]);

  useEffect(() => {
    applyPhase(phase);
  }, [phase]);

  const contacts = useMemo(
    () =>
      initialContacts.map((contact) =>
        contact.id === bot.id && phase.state === 'offline'
          ? {
              ...contact,
              botLiveness: JSON.stringify({ v: 1, state: 'offline' }),
            }
          : contact
      ),
    [phase.state]
  );

  return (
    <ChannelFixtureWrapper theme={theme} contacts={contacts}>
      <Channel
        {...baseProps}
        channel={channel}
        group={null}
        posts={posts}
        // The owner's view, which adds the scheduled tasks action.
        goToScheduledTasks={() => {}}
      />
    </ChannelFixtureWrapper>
  );
}

export default {
  cycle: <BotBaubleFixture />,
  idle: <BotBaubleFixture phase={{ state: 'idle' }} />,
  thinking: <BotBaubleFixture phase={{ state: 'thinking' }} />,
  working: (
    <BotBaubleFixture
      phase={{
        state: 'working',
        tools: [{ toolName: 'web_fetch', label: 'Checking the web' }],
      }}
    />
  ),
  offline: <BotBaubleFixture phase={{ state: 'offline' }} />,
  cycleDark: <BotBaubleFixture theme="dark" />,
};
