export const BOT_DM_WAIT_MS = 15_000;

/**
 * Onboarding is a conversation with the bot, so it lands in the bot DM. The DM
 * is provisioned outside the client, so wait only briefly for it: if it has not
 * arrived, land in the chat furnishing just created rather than hanging on a
 * channel that may never show up.
 */
export async function resolveLandingChannelId({
  botDmId,
  furnishedChatChannelId,
  deadline,
  channelExists,
  wait,
}: {
  botDmId: string | null;
  furnishedChatChannelId: string;
  /** Overall onboarding deadline; the DM wait never outlives it. */
  deadline: number;
  channelExists: (channelId: string) => Promise<boolean>;
  wait: (ms: number) => Promise<void>;
}): Promise<string> {
  if (!botDmId) {
    return furnishedChatChannelId;
  }

  const until = Math.min(Date.now() + BOT_DM_WAIT_MS, deadline);
  while (Date.now() < until) {
    if (await channelExists(botDmId)) {
      return botDmId;
    }
    await wait(500);
  }

  return furnishedChatChannelId;
}
