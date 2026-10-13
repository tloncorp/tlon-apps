/**
 * The group an agent action may act on, or `null` when it may not act.
 *
 * In a group channel the surrounding group binds the action: the post, the
 * channel and the request must all name the same group, so a surface in one
 * group cannot provision another.
 *
 * The bot DM belongs to no group, so there is nothing to bind against. There
 * the request names its own target and authorship takes the place of that
 * binding — only this user's own bot can drive their onboarding. Callers still
 * confirm the user hosts the resolved group before acting on it.
 */
export function resolveAgentActionGroupId({
  postGroupId,
  currentGroupId,
  requestedGroupId,
  postIsFromOwnBot,
}: {
  postGroupId?: string | null;
  currentGroupId?: string | null;
  requestedGroupId?: string | null;
  postIsFromOwnBot: boolean;
}): string | null {
  const groupId = postGroupId ?? currentGroupId ?? null;
  if (!groupId) {
    return postIsFromOwnBot && requestedGroupId ? requestedGroupId : null;
  }
  if (currentGroupId !== groupId || requestedGroupId !== groupId) {
    return null;
  }
  return groupId;
}
