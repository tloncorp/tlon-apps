import { Attachment } from '@tloncorp/shared';

import { imageSize } from '../../../utils/images';

export interface PastedFile {
  fileName: string;
  fileSize: number;
  type: string; // MIME type
  uri: string; // file:// URI
}

export async function attachPastedImageFiles(
  files: PastedFile[],
  addAttachment: (attachment: Attachment) => void
): Promise<void> {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'));

  await Promise.all(
    imageFiles.map(async (file) => {
      // Best-effort dimensions; fall back to a square preview if RN can't read them.
      let width = 300;
      let height = 300;
      try {
        [width, height] = await imageSize(file.uri);
      } catch {
        // keep the fallback dimensions
      }

      addAttachment({
        type: 'image',
        file: {
          uri: file.uri,
          width,
          height,
          mimeType: file.type,
          fileSize: file.fileSize,
        },
      });
    })
  );
}
