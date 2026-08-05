import { expect, test, vi } from 'vitest';

import { attachPastedImageFiles } from './pastedImage';

const imageMocks = vi.hoisted(() => ({ imageSize: vi.fn() }));
vi.mock('../../../utils/images', () => imageMocks);

test('converts image files to image attachments with resolved dimensions', async () => {
  imageMocks.imageSize.mockResolvedValue([640, 480]);
  const addAttachment = vi.fn();

  await attachPastedImageFiles(
    [
      {
        fileName: 'a.png',
        fileSize: 123,
        type: 'image/png',
        uri: 'file:///a.png',
      },
    ],
    addAttachment
  );

  expect(addAttachment).toHaveBeenCalledWith({
    type: 'image',
    file: {
      uri: 'file:///a.png',
      width: 640,
      height: 480,
      mimeType: 'image/png',
      fileSize: 123,
    },
  });
});

test('ignores non-image files', async () => {
  const addAttachment = vi.fn();

  await attachPastedImageFiles(
    [
      {
        fileName: 'a.pdf',
        fileSize: 1,
        type: 'application/pdf',
        uri: 'file:///a.pdf',
      },
    ],
    addAttachment
  );

  expect(addAttachment).not.toHaveBeenCalled();
});

test('falls back to 300x300 when dimensions cannot be read', async () => {
  imageMocks.imageSize.mockRejectedValue(new Error('unreadable'));
  const addAttachment = vi.fn();

  await attachPastedImageFiles(
    [
      {
        fileName: 'a.png',
        fileSize: 5,
        type: 'image/png',
        uri: 'file:///a.png',
      },
    ],
    addAttachment
  );

  expect(addAttachment).toHaveBeenCalledWith({
    type: 'image',
    file: {
      uri: 'file:///a.png',
      width: 300,
      height: 300,
      mimeType: 'image/png',
      fileSize: 5,
    },
  });
});
