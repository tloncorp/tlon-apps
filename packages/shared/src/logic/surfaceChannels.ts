import {
  ChannelContentConfiguration,
  CollectionRendererId,
} from '@tloncorp/api';

/**
 * Unread/activity policy for surface channels (plan §8): the activity path
 * carries neither kind nor blob, so per-post suppression is impossible at
 * the client boundary. Surface channels are instead excluded from unread
 * badges and activity summaries WHOLESALE, keyed off the channel's content
 * configuration — which the client always has. The bot announces noteworthy
 * dashboard changes in a real chat channel when attention is wanted.
 */

/**
 * SQL fragment for the same predicate: the persisted config is a JSON text
 * column, so queries match the renderer id as a substring. The id only ever
 * appears in `defaultPostCollectionRenderer` (draft inputs and content
 * renderers live in other namespaces), so a match means a surface channel;
 * both the string and `{ id }` serializations contain it.
 */
export const SURFACE_CHANNEL_CONFIG_LIKE_PATTERN = `%${CollectionRendererId.surface}%`;

/**
 * Whether a channel is surface-configured. Storage is untrusted — a
 * malformed configuration is simply not a surface channel.
 */
export function isSurfaceChannel(
  channel:
    | {
        contentConfiguration?: ChannelContentConfiguration | null;
      }
    | null
    | undefined
): boolean {
  const configuration = channel?.contentConfiguration;
  if (configuration == null) {
    return false;
  }
  try {
    return (
      ChannelContentConfiguration.defaultPostCollectionRenderer(configuration)
        .id === CollectionRendererId.surface
    );
  } catch {
    return false;
  }
}
