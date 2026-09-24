/**
 * Onboarding is a conversation with the bot, so it lands where the intro
 * request went: the bot DM whenever there is a bot to DM.
 *
 * The DM is provisioned outside the client and its row may not have synced
 * yet, but nothing here needs the row — the tab renders the DM by id. Falling
 * back to the furnished chat instead would open the user on a channel the bot
 * is not talking in, with the pickers arriving in a DM they cannot see; the
 * slow-provisioning path is exactly where that would happen.
 */
export function resolveLandingChannelId({
  botDmId,
  furnishedChatChannelId,
}: {
  botDmId: string | null;
  furnishedChatChannelId: string;
}): string {
  return botDmId ?? furnishedChatChannelId;
}
