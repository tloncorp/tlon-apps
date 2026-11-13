import { expect, test } from 'vitest';
import { Attachment, UploadedImageAttachment } from '../types/attachment';

test('an uploaded image can be reused for a caption edit without uploading again', () => {
  const intent = Attachment.toUploadIntent({
    type: 'image',
    file: {
      uri: '/v1/rooms/gallery/attachments/sample/content?user=galen',
      width: 100,
      height: 100,
    },
    uploadState: {
      status: 'success',
      remoteUri: '/v1/rooms/gallery/attachments/sample/content?user=galen',
    },
  });
  expect(intent.needsUpload).toBe(false);
  if (intent.needsUpload || intent.finalized.type !== 'image')
    throw Error('Image was not finalized');
  expect(UploadedImageAttachment.uri(intent.finalized)).toBe(
    '/v1/rooms/gallery/attachments/sample/content?user=galen'
  );
});

test('a fresh image still requires uploading', () => {
  const file = { uri: 'blob:local-image', width: 100, height: 100 };
  expect(Attachment.toUploadIntent({ type: 'image', file })).toEqual({
    needsUpload: true,
    type: 'image',
    asset: file,
  });
});
