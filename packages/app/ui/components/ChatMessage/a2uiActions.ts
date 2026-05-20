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

function getUserActionName(json: unknown) {
  if (
    typeof json !== 'object' ||
    json === null ||
    !('userAction' in json) ||
    typeof json.userAction !== 'object' ||
    json.userAction === null ||
    !('name' in json.userAction) ||
    typeof json.userAction.name !== 'string'
  ) {
    return '';
  }

  return json.userAction.name;
}

export function getA2UIPokeConfirmationCopy(
  action: A2UI.Button['action'],
  buttonLabel: string
) {
  if (action.event.name !== 'tlon.poke') {
    return {
      actionLabel: 'Run action',
      description: 'This will run the requested action.',
    };
  }

  const userActionName = getUserActionName(action.event.context.json);
  if (userActionName === 'lore.compile.confirm') {
    return {
      actionLabel: 'Compile lore wiki',
      description:
        'This will run the lore compiler and mirror updated wiki/media outputs. No chat message will be sent.',
    };
  }

  return {
    actionLabel: buttonLabel.trim() || 'Run app action',
    description:
      'This will run the requested app action. No chat message will be sent.',
  };
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
  actionLabel,
  description,
  sendText,
  destination,
}: {
  actionName: string;
  buttonLabel: string;
  actionLabel?: string;
  description?: string;
  sendText?: string;
  destination?: string;
}) {
  const lines = [
    `Action: ${actionLabel || actionName}`,
    `Button: ${buttonLabel || 'Untitled button'}`,
  ];

  if (description) {
    lines.push(description);
  }
  if (sendText) {
    lines.push(`Will send: ${sendText}`);
  }
  if (destination) {
    lines.push(`Destination: ${destination}`);
  }

  return lines.join('\n');
}
