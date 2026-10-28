import {
  PlaintextPreviewConfig,
  convertContent,
  plaintextPreviewOf,
  plaintextPreviewOfInlineString,
} from '@tloncorp/api/client/postContent';
import type * as db from '@tloncorp/shared/db';

const config = {
  ...PlaintextPreviewConfig.defaultConfig,
  includeRefTag: false,
};

export function messageSelectionText(
  post: Pick<db.Post, 'content' | 'blob' | 'textContent' | 'isDeleted'>
): string {
  if (post.isDeleted) return '';

  try {
    return convertContent(post.content, post.blob)
      .map((block) => {
        switch (block.type) {
          case 'paragraph':
          case 'blockquote':
          case 'header':
          case 'list':
          case 'bigEmoji':
            return plaintextPreviewOf([block], config);
          case 'code':
            return block.content;
          case 'table':
            return [block.header, ...block.rows]
              .map((row) =>
                row.cells
                  .map((cell) =>
                    plaintextPreviewOfInlineString(cell.content, config)
                  )
                  .join(' \t ')
              )
              .join('\n');
          default:
            return '';
        }
      })
      .filter(Boolean)
      .join('\n');
  } catch {
    // Keep the stored text available if the message payload cannot be decoded.
    return post.textContent ?? '';
  }
}
