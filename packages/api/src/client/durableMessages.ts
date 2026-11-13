import type { LinkMetadata, LinkMetadataError } from '../types/attachment';
import {
  type DurableClient,
  type DurableMessage,
  type DurableUserState,
  durablePostId,
} from './durable';

// Hidden messages are keyed `<room>/<message>` in the account's state, which
// stays on the account's own server.
let hiddenKeys = new Set<string>();

export function setDurableHidden(state: DurableUserState) {
  hiddenKeys = new Set(state.hidden ?? []);
}

export function isDurableHidden(
  client: DurableClient,
  channelId: string,
  messageId: string
) {
  const room = client.bootstrap.rooms.find(
    (room) => room.channelId === channelId
  );
  return !!room && hiddenKeys.has(`${room.id}/${messageId}`);
}

/** The client post IDs of the hidden messages in rooms this account sees. */
export function durableHiddenPostIds(
  client: DurableClient,
  state: DurableUserState
) {
  return (state.hidden ?? []).flatMap((key) => {
    const separator = key.lastIndexOf('/');
    const room = client.bootstrap.rooms.find(
      (room) => room.id === key.slice(0, separator)
    );
    return room
      ? [durablePostId(room.channelId, key.slice(separator + 1))]
      : [];
  });
}

export async function setDurablePostHidden(
  client: DurableClient,
  post: { channelId: string; id: string },
  hidden: boolean
) {
  const state = await client.request<DurableUserState>('/hidden', {
    room: client.room(post.channelId).id,
    id: client.messageId(post.channelId, post.id),
    hidden,
  });
  setDurableHidden(state);
}

export async function setDurableBlocked(
  client: DurableClient,
  contactId: string,
  blocked: boolean
) {
  await client.request<DurableUserState>('/blocks', { contactId, blocked });
}

export async function durableBlockedContacts(client: DurableClient) {
  return (await client.state()).blocked ?? [];
}

// A reference names a message by its client post ID, which the server also
// knows as an alias; citations carry it in @ud form, with dots. A viewer
// outside the room gets a 404 from the server, or no room at all here; either
// shows the reference as unavailable.
export async function durableReferencedMessage(
  client: DurableClient,
  channelId: string,
  postId: string
) {
  const room = client.bootstrap.rooms.find(
    (room) => room.channelId === channelId
  );
  if (!room) throw new Error('This reference is unavailable');
  return client.request<DurableMessage>(
    `/rooms/${encodeURIComponent(room.id)}/message?id=${encodeURIComponent(
      client.messageId(channelId, postId.replace(/\./g, ''))
    )}`
  );
}

export async function durableLinkPreview(
  client: DurableClient,
  url: string
): Promise<LinkMetadata | LinkMetadataError> {
  const preview = await client.request<{
    url: string;
    type: 'page' | 'image';
    title: string;
    description: string;
    siteName: string;
    previewImageUrl: string;
  }>(`/link-preview?url=${encodeURIComponent(url)}`);
  if (preview.type === 'image')
    return { type: 'file', url, mime: 'image/*', isImage: true };
  return {
    type: 'page',
    url,
    title: preview.title || undefined,
    description: preview.description || undefined,
    siteName: preview.siteName || undefined,
    previewImageUrl: preview.previewImageUrl || undefined,
  };
}

// Whatever a browser would load from a server other than this page's or the
// account's, resolved against the page as the browser resolves it (`//host`,
// `https:/host` on an http page, backslashes and leading spaces can all reach
// another server).
export function isRemoteUrl(value: unknown, origin: string): value is string {
  if (typeof value !== 'string' || value === '') return false;
  const page = globalThis.location?.href ?? origin;
  try {
    const resolved = new URL(value, page).origin;
    return resolved !== origin && resolved !== new URL(page).origin;
  } catch {
    return true;
  }
}

/** An http(s) link to another server, which the composer leaves to the host. */
export function isLinkedImage(value: string, origin: string) {
  return /^https?:\/\//i.test(value) && isRemoteUrl(value, origin);
}

/** Drops images in a post blob that would load from another server. */
export function withoutRemoteBlobMedia(
  value: unknown,
  origin: string
): unknown {
  if (Array.isArray(value))
    return value.map((item) => withoutRemoteBlobMedia(item, origin));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, item]) =>
            !['src', 'posterUri'].includes(key) || !isRemoteUrl(item, origin)
        )
        .map(([key, item]) => [key, withoutRemoteBlobMedia(item, origin)])
    );
  return value;
}

type Verse = {
  block?: {
    image?: { src?: unknown };
    link?: { url: string; meta?: Record<string, unknown> };
  };
};

// The group's host replaces linked images with stored copies just after a
// message is posted. Until then, and when it can't, a remote image shows as
// a plain link so no reader's browser contacts the image's server.
export function withoutRemoteImages(content: unknown[], origin: string) {
  return content.map((verse) => {
    const block = (verse as Verse).block;
    const src = block?.image?.src;
    if (isRemoteUrl(src, origin))
      return { inline: [{ link: { href: src, content: src } }] };
    const meta = block?.link?.meta;
    if (
      block?.link &&
      meta &&
      (isRemoteUrl(meta.previewImageUrl, origin) || meta.siteIconUrl)
    ) {
      const kept = { ...meta };
      delete kept.siteIconUrl;
      if (isRemoteUrl(meta.previewImageUrl, origin))
        for (const key of [
          'previewImageUrl',
          'previewImageWidth',
          'previewImageHeight',
        ])
          delete kept[key];
      return { block: { ...block, link: { ...block.link, meta: kept } } };
    }
    return verse;
  });
}
