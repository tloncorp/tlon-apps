import { getDurableClient } from '@tloncorp/api/client/durable';
import type { MessageSearchHit } from '@tloncorp/api/client/messageSearch';
import { durableMessageToPost } from '@tloncorp/api/client/postsApi';
import * as db from '../db';
import { createDevLogger } from '../debug';

const logger = createDevLogger('message search', false);

export async function prepareMessageSearchResult(hit: MessageSearchHit) {
  const client = getDurableClient();
  if (!client) throw new Error('Message search is unavailable');
  const channelId = hit.post.channelId;
  try {
    const target = await client.message(channelId, hit.post.id);
    if (target.deleted) throw new Error('This message was deleted');
    const groupId = client.room(channelId).groupId;
    const parent = target.parentId
      ? await client.message(channelId, target.parentId)
      : undefined;
    const page = await client.window(channelId, {
      mode: 'around',
      anchor: parent ? target.seq : (target.channelSeq ?? target.seq),
      parentId: parent?.id,
      count: 50,
    });
    const posts = page.messages.map((message) => ({
      ...durableMessageToPost(channelId, message),
      groupId,
    }));
    const parentPost = parent
      ? { ...durableMessageToPost(channelId, parent), groupId }
      : undefined;
    await db.insertChannelPosts({
      posts: parentPost ? [parentPost, ...posts] : posts,
    });
    const channel = await db.getChannel({ id: channelId });
    if (!channel) throw new Error('This conversation is unavailable');
    logger.trackEvent('Message Search Result Opened', {
      thread: Boolean(parentPost),
    });
    return { channel, parent: parentPost, selectedPostId: hit.post.id };
  } catch (error) {
    logger.trackError('Opening search result failed', { error });
    throw error;
  }
}
