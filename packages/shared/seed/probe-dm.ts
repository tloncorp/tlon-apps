/**
 * TEMPORARY session-6a harness: send a 1:1 DM as ~ten to ~zod.
 *
 * The tlon CLI deliberately does not send 1:1 DMs (the OpenClaw channel
 * plugin owns that path), so driving the bot as its owner needs this.
 * Delete when the image-handoff probe is done.
 *
 *   pnpm --filter @tloncorp/shared exec vite-node --config seed/vite.config.ts \
 *     seed/probe-dm.ts -- "<message>"
 */
import * as api from '@tloncorp/api';

import { SHIPS, connectAs, resetDatabase } from './shipClient';

async function main() {
  const message = process.argv.slice(2).join(' ');
  if (!message) {
    throw new Error('usage: probe-dm.ts "<message>"');
  }
  resetDatabase();
  await connectAs(SHIPS.ten);
  await api.sendPost({
    channelId: SHIPS.zod.name,
    authorId: SHIPS.ten.name,
    sentAt: Date.now(),
    content: [{ inline: [message] }],
  });
  console.log(`sent as ${SHIPS.ten.name} -> ${SHIPS.zod.name}`);
  process.exit(0);
}

void main();
