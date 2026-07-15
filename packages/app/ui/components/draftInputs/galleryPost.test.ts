import type { Attachment } from '@tloncorp/shared/domain';
import { expect, test, vi } from 'vitest';

import {
  buildGalleryAttachmentPostDrafts,
  sendGalleryAttachmentPostsSequentially,
} from './galleryPost';

const image = (uri: string): Attachment => ({
  type: 'image',
  file: { uri, width: 100, height: 100 },
});

const file = (name: string): Attachment => ({
  type: 'file',
  localFile: `file:///tmp/${name}`,
  name,
  size: 100,
  mimeType: 'text/plain',
});

test('builds one gallery post per attachment in selection order', () => {
  const drafts = buildGalleryAttachmentPostDrafts({
    attachments: [image('file:///first.jpg'), file('second.txt')],
    caption: 'A shared caption',
    channelId: 'heap/~zod/gallery',
    channelType: 'gallery',
  });

  expect(drafts).toHaveLength(2);
  expect(drafts[0]).toMatchObject({
    attachments: [image('file:///first.jpg')],
    content: ['A shared caption'],
    image: 'file:///first.jpg',
    isEdit: false,
  });
  expect(drafts[1]).toMatchObject({
    attachments: [file('second.txt')],
    content: ['A shared caption'],
    image: undefined,
    isEdit: false,
  });
});

test('keeps all attachments together when editing an existing post', () => {
  const attachments = [image('file:///first.jpg'), file('second.txt')];
  const drafts = buildGalleryAttachmentPostDrafts({
    attachments,
    caption: '',
    channelId: 'heap/~zod/gallery',
    channelType: 'gallery',
    editTargetPostId: '1700000000000',
  });

  expect(drafts).toEqual([
    expect.objectContaining({
      attachments,
      isEdit: true,
      editTargetPostId: '1700000000000',
    }),
  ]);
});

test('sends gallery attachment posts sequentially', async () => {
  const drafts = buildGalleryAttachmentPostDrafts({
    attachments: [image('file:///first.jpg'), image('file:///second.jpg')],
    caption: '',
    channelId: 'heap/~zod/gallery',
    channelType: 'gallery',
  });
  const sentImages: (string | undefined)[] = [];
  let activeSends = 0;
  let maxActiveSends = 0;
  const sendPost = vi.fn(async (draft) => {
    activeSends += 1;
    maxActiveSends = Math.max(maxActiveSends, activeSends);
    await Promise.resolve();
    sentImages.push(draft.image);
    activeSends -= 1;
  });

  await sendGalleryAttachmentPostsSequentially(drafts, sendPost);

  expect(maxActiveSends).toBe(1);
  expect(sentImages).toEqual(['file:///first.jpg', 'file:///second.jpg']);
});
