export type BotSettingsPendingFields = {
  nickname: boolean;
  modelProvider: boolean;
  model: boolean;
  fallbacks: boolean;
  dmAllowlist: boolean;
  defaultAuthorizedShips: boolean;
  groupInviteAllowlist: boolean;
  autoAcceptDmInvites: boolean;
  autoDiscoverChannels: boolean;
  channelRules: boolean;
};

export const getChangeLabels = (
  pending: BotSettingsPendingFields
): string[] => {
  const labels: string[] = [];
  if (pending.nickname) labels.push('Nickname');
  if (pending.modelProvider || pending.model) labels.push('Default model');
  if (pending.fallbacks) labels.push('Fallback models');
  if (pending.dmAllowlist) labels.push('DM allowlist');
  if (pending.defaultAuthorizedShips) labels.push('Authorized ships');
  if (pending.groupInviteAllowlist) labels.push('Group invites');
  if (pending.autoAcceptDmInvites) labels.push('DM invites');
  if (pending.autoDiscoverChannels) labels.push('Auto-discover');
  if (pending.channelRules) labels.push('Channel rules');
  return labels;
};
