import { useMutableRef } from '@tloncorp/shared';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TextArea, View } from 'tamagui';

import { useCurrentUserId } from '../contexts';
import { RenderItemType } from '../contexts/componentsKits';
import { ChatAuthorRow } from './AuthorRow';

export const EditableNotePostContent: RenderItemType = ({
  post,
  showAuthor,
  editPost,
}) => {
  const [textBuffer, setTextBuffer] = useState(post.textContent ?? '');

  const postRef = useMutableRef(post);
  useDebouncedUpdatePostEffect({
    editPost: useCallback(
      async (text: string) => {
        if (editPost == null) {
          return;
        }
        try {
          await editPost(postRef.current, [{ inline: [text] }]);
        } catch (err) {
          console.error('Failed to edit', err);
        }
      },
      [editPost, postRef]
    ),
    textBuffer,
  });

  const currentUserId = useCurrentUserId();
  const canEdit = currentUserId === post.authorId;

  return (
    <View flex={1}>
      {showAuthor && (
        <ChatAuthorRow
          padding="$l"
          paddingBottom="$s"
          author={post.author}
          authorId={post.authorId}
        />
      )}
      <TextArea
        flex={1}
        value={textBuffer}
        onChangeText={setTextBuffer}
        editable={canEdit}
        borderColor={'$secondaryBorder'}
      />
    </View>
  );
};

function useDebouncedUpdatePostEffect({
  editPost,
  textBuffer,
}: {
  editPost: (newText: string) => Promise<void>;
  textBuffer: string;
}) {
  const debouncedUpdatePost = useMemo(
    () => debounce(editPost, 2000),
    [editPost]
  );
  useEffect(() => {
    debouncedUpdatePost(textBuffer);
  }, [textBuffer, debouncedUpdatePost]);

  // Ensure we do a synchronous update on unmount
  const textBufferRef = useMutableRef(textBuffer);
  const editPostRef = useMutableRef(editPost);
  useEffect(
    () => () => {
      editPostRef.current(textBufferRef.current);
    },
    [editPostRef, textBufferRef]
  );
}
