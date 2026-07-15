import type { Attachment } from '@tloncorp/shared/domain';
import { expect, test, vi } from 'vitest';

import {
  buildGalleryAttachmentPostDrafts,
  enqueueGalleryAttachmentPosts,
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

const video = (name: string): Attachment => ({
  type: 'video',
  localFile: `file:///tmp/${name}`,
  name,
  size: 1_000,
  mimeType: 'video/mp4',
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

test('builds a separate post for every selected video', () => {
  const drafts = buildGalleryAttachmentPostDrafts({
    attachments: [video('first.mp4'), video('second.mp4')],
    caption: '',
    channelId: 'heap/~zod/gallery',
    channelType: 'gallery',
  });

  expect(drafts.map((draft) => draft.attachments)).toEqual([
    [video('first.mp4')],
    [video('second.mp4')],
  ]);
});

test('enqueues every gallery attachment post before waiting', async () => {
  const drafts = buildGalleryAttachmentPostDrafts({
    attachments: [image('file:///first.jpg'), image('file:///second.jpg')],
    caption: '',
    channelId: 'heap/~zod/gallery',
    channelType: 'gallery',
  });
  const queuedImages: (string | undefined)[] = [];
  const releaseSends: (() => void)[] = [];
  const sendPost = vi.fn((draft) => {
    queuedImages.push(draft.image);
    return new Promise<void>((resolve) => {
      releaseSends.push(resolve);
    });
  });

  const pending = enqueueGalleryAttachmentPosts(drafts, sendPost);
  await Promise.resolve();

  expect(sendPost).toHaveBeenCalledTimes(2);
  expect(queuedImages).toEqual(['file:///first.jpg', 'file:///second.jpg']);

  releaseSends.forEach((release) => release());
  await pending;
});
