/**
 * DM reaction events identify their target as either a bare `<ud>` or a full
 * `~ship/<ud>` writ id; the /v4 backend serializes DM ids in the full form.
 * DM replies require an author-prefixed writ id, so reactions dispatched for
 * a bot-authored target must retain the bot as the parent author.
 */
export function dmReactionReplyParentId(
  botShip: string,
  targetId: string
): string {
  const separator = targetId.indexOf('/');
  const bareTargetId =
    separator === -1 ? targetId : targetId.slice(separator + 1);
  return `${botShip}/${bareTargetId}`;
}
