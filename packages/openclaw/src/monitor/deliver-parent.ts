export function resolveDeliverParentId(params: {
  isGroup: boolean;
  channelNest?: string;
  /** Trigger's own id ('' when unknown). */
  messageId: string;
  parentId?: string | null;
  isThreadReply?: boolean;
  replyParentId?: string | null;
  /** Retry dispatch reconstructed without a retrySeed — threading metadata
   *  defaulted, messageId may be synthetic; never synthesize an anchor. */
  degraded?: boolean;
}): string | null {
  const explicit = params.replyParentId ?? params.parentId ?? null;
  if (explicit != null) {
    return explicit;
  }
  // A top-level heap post is a separate gallery item, not a conversational
  // reply — anchor reactive replies to the triggering post as a comment.
  // Chat keeps linear top-level replies.
  if (
    params.isGroup &&
    !params.isThreadReply &&
    !params.degraded &&
    Boolean(params.channelNest?.startsWith('heap/')) &&
    params.messageId
  ) {
    return params.messageId;
  }
  return null;
}
