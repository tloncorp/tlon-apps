/**
 * Rows from `getUnreadUnseenActivityEvents`: a bare `.select()` across joins,
 * so drizzle keys each table by its SQL name and the event sits under
 * `activity_events`.
 */
export type UnseenActivityRow = {
  activity_events?: { id?: string | null; channelId?: string | null } | null;
};

/**
 * How many unseen events deserve a badge, optionally leaving one channel out.
 *
 * One logical event is stored once per bucket it lands in — `all`, and again
 * under `mentions` or `replies` — because the bucket is part of the key, and
 * the query does not collapse them. Counting rows would show a mentioned reply
 * as three notifications; count distinct event ids instead.
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
  const ids = new Set<string>();
  let withoutId = 0;
  for (const row of rows) {
    const event = row.activity_events;
    if (excludeChannelId && event?.channelId === excludeChannelId) continue;
    if (event?.id) ids.add(event.id);
    else withoutId += 1;
  }
  return ids.size + withoutId;
}
