import { isBotUserId } from '@tloncorp/api/client/apiUtils';

import { parseBotInfo } from './slashCommands';

// A contact is a bot when either signal says so: its id carries the fixed
// `~pinser-botter-` moon prefix that Tlon-hosted bots use, or it publishes a
// parseable `bot-info` identity claim (docs/bot-info.md). The claim is
// self-published and only shape-validated, so a third-party harness counts too.
export function isBotContact(args: {
  id?: string | null;
  botInfo?: string | null;
}): boolean {
  return isBotUserId(args.id) || parseBotInfo(args.botInfo) !== null;
}
