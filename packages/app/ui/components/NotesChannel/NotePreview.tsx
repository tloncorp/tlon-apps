import type * as cn from '@tloncorp/shared/logic';

import { NotebookContentRenderer } from '../NotebookPost/NotebookPost';

// Web keeps the browser's own selection over the React renderer.
export function NotePreview({
  content,
  testID,
}: {
  content: cn.PostContent;
  testID?: string;
}) {
  return (
    <NotebookContentRenderer
      content={content}
      marginHorizontal="$-l"
      testID={testID}
    />
  );
}
