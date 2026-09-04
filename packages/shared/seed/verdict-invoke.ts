/**
 * Put real member state into a verdict-run dashboard, as the members.
 *
 * The structural revision in the verdict run — "add a Blocked column between
 * Doing and Done" — is only a state-preservation measurement if there is state
 * to preserve when it is issued. A board whose fold is `0 events` migrates
 * trivially, and "existing cards survived in their columns" would be a claim
 * about nothing.
 *
 * So this posts ordinary `surface-event` invokes, as the ships that would post
 * them, through exactly the path a member's tap takes: one blob entry per
 * post, `mode: 'invoke'`, `actionId` naming a DECLARED action, the spec
 * revision the board is currently at. It writes no ops of its own — a host op
 * would be a different kind of write with different provenance, and the point
 * is to leave member-authored state behind.
 *
 * Usage (repo root, rube fakeships up):
 *
 *   pnpm --filter @tloncorp/shared exec vite-node --config seed/vite.config.ts \
 *     seed/verdict-invoke.ts -- --channel chat/~zod/dash-xxxx \
 *       --as zod:move-a --as ten:move-b
 *
 * `--as <ship>:<actionId>` may be repeated; the invokes are posted in the
 * order given, grouped by ship (each ship connects once).
 */
import * as api from '@tloncorp/api';
import { constructStory } from '@tloncorp/api/urbit';

import * as db from '../src/db';
import * as store from '../src/store';
import { SHIPS, connectAs, disconnect, resetDatabase } from './shipClient';

type Ship = 'zod' | 'ten';

function parseArgs(argv: string[]) {
  let channel: string | null = null;
  const invokes: { as: Ship; actionId: string }[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--channel') {
      channel = argv[i + 1] ?? null;
      i += 1;
    } else if (argv[i] === '--as') {
      const raw = argv[i + 1] ?? '';
      const [ship, actionId] = raw.split(':');
      if ((ship !== 'zod' && ship !== 'ten') || !actionId) {
        throw new Error(`--as wants <zod|ten>:<actionId>, got "${raw}"`);
      }
      invokes.push({ as: ship, actionId });
      i += 1;
    }
  }
  if (!channel) throw new Error('--channel is required');
  if (invokes.length === 0) throw new Error('at least one --as is required');
  return { channel, invokes };
}

/**
 * The published spec, out of the group's channel metadata — the same place
 * `tlon surface show` reads it from, so an invoke can never be stamped with a
 * revision the channel is not actually at.
 */
async function readSpec(
  channelId: string
): Promise<{ surfaceId: string; specRevision: number; actions: string[] }> {
  const groups = await api.scry<
    Record<
      string,
      { channels?: Record<string, { meta?: { description?: string } }> }
    >
  >({ app: 'groups', path: '/v2/groups' });
  let description: string | undefined;
  for (const group of Object.values(groups)) {
    const found = group.channels?.[channelId]?.meta?.description;
    if (found) {
      description = found;
      break;
    }
  }
  if (!description) {
    throw new Error(`no channel metadata for ${channelId}`);
  }
  const payload = JSON.parse(description);
  const spec = payload.surfaceSpec ?? payload;
  return {
    surfaceId: spec.surfaceId,
    specRevision: spec.specRevision,
    actions: Object.keys(spec.actions ?? {}),
  };
}

async function main() {
  const { channel, invokes } = parseArgs(process.argv.slice(2));

  await connectAs(SHIPS.zod);
  const spec = await readSpec(channel);
  console.log(
    `${channel}: surfaceId=${spec.surfaceId} specRevision=${spec.specRevision}`
  );
  // A typo'd actionId posts a real event the reducer then ignores, which is
  // indistinguishable from a state bug later. Refuse it here instead.
  for (const invoke of invokes) {
    if (!spec.actions.includes(invoke.actionId)) {
      throw new Error(
        `${invoke.actionId} is not a declared action on ${channel}; declared: ${spec.actions.join(', ')}`
      );
    }
  }
  disconnect();

  for (const ship of ['zod', 'ten'] as Ship[]) {
    const mine = invokes.filter((i) => i.as === ship);
    if (mine.length === 0) continue;
    resetDatabase();
    await connectAs(SHIPS[ship]);
    await store.setupHighPrioritySubscriptions();
    await store.syncGroups();
    for (const invoke of mine) {
      await api.sendPost({
        channelId: channel,
        authorId: api.getCurrentUserId(),
        content: constructStory([
          'Used this dashboard. Update Tlon to view it.',
        ]),
        blob: JSON.stringify([
          {
            type: 'surface-event',
            version: 1,
            surfaceId: spec.surfaceId,
            specRevision: spec.specRevision,
            mode: 'invoke',
            actionId: invoke.actionId,
          },
        ]),
        sentAt: Date.now(),
        kindTail: 'surface/event',
      });
      console.log(`  ~${ship} invoked ${invoke.actionId}`);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    disconnect();
  }
  console.log('done');
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// keep the db import referenced for the seed tsconfig's module resolution
void db;
