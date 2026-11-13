import { expect, test } from 'vitest';
import type { DurableBootstrap, DurableRoomSummary } from '../client/durable';
import { durableComputingPresence } from '../client/durablePresence';
import { parseComputingStatus } from '../client/computingStatus';

const bootstrap: DurableBootstrap = {
  user: { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
  people: [],
  bot: { contactId: '~dur', name: 'Brian’s Pi' },
  groups: [],
  revision: 0,
  rooms: [
    {
      id: 'general',
      channelId: 'chat/~sampel-palnet/general',
      title: 'General',
      kind: 'channel',
      groupId: null,
      members: ['brian'],
    },
  ],
};
const summary: DurableRoomSummary = {
  roomId: 'general',
  computing: true,
  computingAgents: ['~dur', '~pen'],
  cursor: 0,
  newestSequenceNum: 0,
  rootSequenceNum: 0,
  unread: { count: 0, countWithoutThreads: 0, firstUnreadId: null },
};

test('each agent gets its own commentary and structured tool labels', () => {
  const states = durableComputingPresence(
    bootstrap,
    [
      {
        ...summary,
        computingProgress: {
          '~dur': {
            commentary: 'Checking the recent messages.',
            toolNames: ['tlon_read_history'],
          },
          '~pen': { toolNames: ['current_time'] },
        },
      },
    ],
    123
  );
  expect(states.map((s) => [s.key.ship, s.display.text])).toEqual([
    ['~dur', 'Checking the recent messages.'],
    ['~pen', 'Checking the time'],
  ]);
  expect(parseComputingStatus(states[0].display.blob)?.toolCalls).toEqual([
    { toolName: 'tlon_read_history', label: 'Reading chat history' },
  ]);
  expect(states[0].timing.since).toBe(123);
});

test('idle and inaccessible rooms clear progress; old summaries still show thinking', () => {
  expect(
    durableComputingPresence(bootstrap, [{ ...summary, computing: false }])
  ).toEqual([]);
  expect(
    durableComputingPresence(
      { ...bootstrap, rooms: [{ ...bootstrap.rooms[0], left: ['brian'] }] },
      [summary]
    )
  ).toEqual([]);
  expect(
    durableComputingPresence(bootstrap, [
      { ...summary, computingAgents: undefined },
    ])[0].display.text
  ).toBe('Thinking...');
});
