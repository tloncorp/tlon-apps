import { isDmChannelId } from '@tloncorp/api/client';
import type * as db from '@tloncorp/shared/db';
import type { A2UI } from '@tloncorp/shared/logic';

const CHAT_LIKE_CHANNEL_TYPES: db.ChannelType[] = ['chat', 'dm', 'groupDm'];

export function isA2UIRenderableChatContext({
  channel,
  postChannelId,
  searchQuery,
}: {
  channel?: Pick<db.Channel, 'type'> | null;
  postChannelId: string;
  searchQuery?: string;
}) {
  if (searchQuery) {
    return false;
  }

  if (channel) {
    return CHAT_LIKE_CHANNEL_TYPES.includes(channel.type);
  }

  return isDmChannelId(postChannelId);
}

export function getA2UISendText(
  action: A2UI.Button['action'],
  fallbackText: string
) {
  if (action.event.name !== 'tlon.sendMessage') {
    return '';
  }
  return (action.event.context?.text ?? fallbackText).trim();
}

export function getA2UIPokePayload(action: A2UI.Button['action']) {
  if (action.event.name !== 'tlon.poke') {
    return '';
  }

  return JSON.stringify(action.event.context.json ?? null, null, 2);
}

export function getA2UIDestinationLabel({
  channel,
  group,
}: {
  channel?: Pick<db.Channel, 'id' | 'title' | 'type'> | null;
  group?: Pick<db.Group, 'id' | 'title'> | null;
}) {
  if (!channel) {
    return 'current conversation';
  }

  const channelTitle = channel.title?.trim() || channel.id;
  const groupTitle = group?.title?.trim();

  switch (channel.type) {
    case 'dm':
      return `DM with ${channelTitle}`;
    case 'groupDm':
      return `Group DM: ${channelTitle}`;
    default:
      return groupTitle ? `${channelTitle} in ${groupTitle}` : channelTitle;
  }
}

export function getA2UIConfirmationDescription({
  actionName,
  buttonLabel,
  sendText,
  destination,
  app,
  mark,
  json,
}: {
  actionName: string;
  buttonLabel: string;
  sendText?: string;
  destination?: string;
  app?: string;
  mark?: string;
  json?: string;
}) {
  const lines = [
    `Action: ${actionName}`,
    `Button: ${buttonLabel || 'Untitled button'}`,
  ];

  if (sendText) {
    lines.push(`Will send: ${sendText}`);
  }
  if (destination) {
    lines.push(`Destination: ${destination}`);
  }
  if (app) {
    lines.push(`App: %${app}`);
  }
  if (mark) {
    lines.push(`Mark: %${mark}`);
  }
  if (json) {
    lines.push(`JSON: ${json}`);
  }

  return lines.join('\n');
}
