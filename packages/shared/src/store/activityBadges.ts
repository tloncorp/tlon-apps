/**
 * Rows from `getUnreadUnseenActivityEvents`: a bare `.select()` across joins,
 * so drizzle keys each table by its SQL name and the event sits under
 * `activity_events`.
 */
export type UnseenActivityRow = {
  activity_events?: { channelId?: string | null } | null;
};

/**
 * How many unseen events deserve a badge, optionally leaving one channel out.
 *
 * The bot DM has a badge of its own on the first tab, and its unread posts are
 * also activity events. Counting them again on Workspaces and the bell would
 * light three indicators for one message, so those callers exclude it and
 * badge only what is happening elsewhere.
 */
export function countUnseenActivity(
  rows: readonly UnseenActivityRow[] | null | undefined,
  { excludeChannelId }: { excludeChannelId?: string | null } = {}
): number {
  if (!rows?.length) return 0;
  if (!excludeChannelId) return rows.length;
  return rows.filter(
    (row) => row.activity_events?.channelId !== excludeChannelId
  ).length;
}
