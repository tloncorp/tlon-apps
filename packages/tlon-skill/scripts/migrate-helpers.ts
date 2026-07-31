import { commandError } from './commands/command';
import type { GroupChannelV7, MigrationDeps } from './notes-migrate';
import { normalizeShip } from './notes-migrate';

function requireRawChannel(
  raw: Record<string, unknown>,
  groupId: string,
  nest: string
): Record<string, unknown> {
  const channels = raw.channels;
  if (!channels || typeof channels !== 'object' || Array.isArray(channels)) {
    throw commandError(
      `Group ${groupId}: raw v7 channels are missing or malformed`
    );
  }
  const channel = (channels as Record<string, unknown>)[nest];
  if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
    throw commandError(
      `Channel ${nest} not found in group ${groupId} — cannot rename`
    );
  }
  return channel as Record<string, unknown>;
}

function requireRawMeta(
  channel: Record<string, unknown>,
  nest: string
): Record<string, unknown> {
  const meta = channel.meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    throw commandError(
      `Channel ${nest}: raw metadata is missing or malformed — cannot rename losslessly`
    );
  }
  return meta as Record<string, unknown>;
}

export async function archiveRename(
  deps: Pick<MigrationDeps, 'getRawGroup' | 'updateChannel'>,
  groupId: string,
  nest: string,
  newTitle: string
): Promise<void> {
  const raw = await deps.getRawGroup(groupId);
  const original = requireRawChannel(raw, groupId, nest);
  requireRawMeta(original, nest);

  const channel = JSON.parse(JSON.stringify(original)) as GroupChannelV7;
  channel.meta = { ...channel.meta, title: newTitle };
  await deps.updateChannel({
    groupId,
    channelId: nest,
    channel,
  });

  const confirmedRaw = await deps.getRawGroup(groupId);
  const confirmedChannel = requireRawChannel(confirmedRaw, groupId, nest);
  const confirmedMeta = requireRawMeta(confirmedChannel, nest);
  if (confirmedMeta.title !== newTitle) {
    throw commandError(
      `Source rename was not confirmed: ${nest} still has title ${JSON.stringify(
        confirmedMeta.title
      )}, expected ${JSON.stringify(newTitle)}`
    );
  }
}

export function assertActingShipIsHost(
  actingShip: string,
  host: string,
  context: string
): void {
  const normalizedActing = normalizeShip(actingShip);
  const normalizedHost = normalizeShip(host);
  if (normalizedActing !== normalizedHost) {
    throw commandError(
      `${context}: acting ship ${normalizedActing} is not the host ${normalizedHost}. Migration must run from the ship that hosts it.`
    );
  }
}
