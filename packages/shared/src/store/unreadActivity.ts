type UnreadActivity = {
  count?: number | null;
  notify?: boolean | null;
};

type ChannelUnreadActivity = UnreadActivity & {
  countWithoutThreads?: number | null;
};

export function hasUnreadActivity(unread?: UnreadActivity | null) {
  return (unread?.count ?? 0) > 0 || unread?.notify === true;
}

export function isUnreadActivityCleared(unread?: UnreadActivity | null) {
  return !hasUnreadActivity(unread);
}

export function hasMainChannelUnreadActivity({
  unread,
  hasChildThreadUnreadActivity = false,
  childThreadUnreadActivityKnown = true,
}: {
  unread?: ChannelUnreadActivity | null;
  hasChildThreadUnreadActivity?: boolean;
  childThreadUnreadActivityKnown?: boolean;
}) {
  const count = unread?.count ?? 0;
  const countWithoutThreads = unread?.countWithoutThreads ?? 0;
  const hasMainUnreadCount = countWithoutThreads > 0;
  const notifyBelongsToMainChannel = count === countWithoutThreads;
  const childThreadStateIsClear =
    childThreadUnreadActivityKnown && !hasChildThreadUnreadActivity;

  return (
    hasMainUnreadCount ||
    (!!unread?.notify && notifyBelongsToMainChannel && childThreadStateIsClear)
  );
}
