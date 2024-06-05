import {
  extractContentTypesFromPost,
  findFirstImageBlock,
  isImagePost,
  isReferencePost,
  isTextPost,
  textPostIsLinkedImage,
  textPostIsReference,
  tiptap,
} from '@tloncorp/shared/dist';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { useCallback, useMemo } from 'react';
import { Dimensions } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

import { Image, Text, View, YStack } from '../../core';
import ContentReference from '../ContentReference';
import ContentRenderer from '../ContentRenderer';
import { DetailView, DetailViewProps } from './DetailView';

export default function GalleryDetailView({
  post,
  currentUserId,
  editingPost,
  setEditingPost,
  editPost,
  sendReply,
  groupMembers,
  posts,
  onPressImage,
  uploadInfo,
  storeDraft,
  clearDraft,
  getDraft,
  goBack,
}: DetailViewProps) {
  // We want the content of the detail view to take up 70% of the screen height
  const HEIGHT_DETAIL_VIEW_CONTENT = Dimensions.get('window').height * 0.5;
  // We want the content of the detail view to take up 100% of the screen width
  const WIDTH_DETAIL_VIEW_CONTENT = Dimensions.get('window').width;

  const { inlines, references, blocks } = useMemo(
    () => extractContentTypesFromPost(post),
    [post]
  );

  const postIsJustImage = useMemo(() => isImagePost(post), [post]);
  const postIsJustText = useMemo(() => isTextPost(post), [post]);
  const postIsJustReference = useMemo(() => isReferencePost(post), [post]);

  const image = useMemo(
    () => (postIsJustImage ? findFirstImageBlock(blocks)?.image : null),
    [blocks, postIsJustImage]
  );

  const textPostIsJustLinkedImage = useMemo(
    () => textPostIsLinkedImage(post),
    [post]
  );

  const textPostIsJustReference = useMemo(
    () => textPostIsReference(post),
    [post]
  );

  const linkedImage = useMemo(
    () =>
      textPostIsJustLinkedImage
        ? (inlines[0] as urbit.Link).link.href
        : undefined,
    [inlines, textPostIsJustLinkedImage]
  );

  const handleImagePressed = useCallback(
    (uri: string) => {
      onPressImage?.(post, uri);
    },
    [onPressImage, post]
  );

  if (
    !postIsJustImage &&
    !postIsJustText &&
    !postIsJustReference &&
    !textPostIsJustReference
  ) {
    // This should never happen, but if it does, we should log it
    const content = JSON.parse(post.content as string);
    console.log('Unsupported post type', {
      post,
      content,
    });

    return (
      <View padding="$m" key={post.id} position="relative" alignItems="center">
        <Text>Unsupported post type</Text>
      </View>
    );
  }

  return (
    <DetailView
      post={post}
      currentUserId={currentUserId}
      editingPost={editingPost}
      setEditingPost={setEditingPost}
      editPost={editPost}
      sendReply={sendReply}
      groupMembers={groupMembers}
      posts={posts}
      onPressImage={onPressImage}
      uploadInfo={uploadInfo}
      storeDraft={storeDraft}
      clearDraft={clearDraft}
      getDraft={getDraft}
      goBack={goBack}
    >
      <DetailView.Header replyCount={post.replyCount ?? 0}>
        <View paddingHorizontal="$xl" key={post.id} alignItems="center">
          {(postIsJustImage || textPostIsJustLinkedImage) && (
            <TouchableOpacity
              onPress={() =>
                handleImagePressed(postIsJustImage ? image!.src : linkedImage!)
              }
            >
              <YStack gap="$s">
                <Image
                  source={{
                    uri: postIsJustImage ? image!.src : linkedImage,
                  }}
                  contentFit="contain"
                  width={WIDTH_DETAIL_VIEW_CONTENT}
                  height={HEIGHT_DETAIL_VIEW_CONTENT}
                />
                {inlines.length > 0 && !textPostIsJustLinkedImage && (
                  <View paddingHorizontal="$m">
                    <Text>{tiptap.inlineToString(inlines[0])}</Text>
                  </View>
                )}
              </YStack>
            </TouchableOpacity>
          )}
          {postIsJustText &&
            !textPostIsJustLinkedImage &&
            !textPostIsJustReference && (
              <View
                backgroundColor="$background"
                borderRadius="$l"
                padding="$l"
                width={WIDTH_DETAIL_VIEW_CONTENT}
                height={HEIGHT_DETAIL_VIEW_CONTENT}
              >
                <View
                  height="100%"
                  width="100%"
                  overflow="hidden"
                  paddingBottom="$xs"
                  position="relative"
                >
                  <ContentRenderer post={post} />
                </View>
              </View>
            )}
          {(postIsJustReference || textPostIsJustReference) && (
            <View
              width={WIDTH_DETAIL_VIEW_CONTENT}
              height={HEIGHT_DETAIL_VIEW_CONTENT}
              borderRadius="$l"
              padding="$m"
              overflow="hidden"
            >
              <View
                height="100%"
                width="100%"
                overflow="hidden"
                paddingBottom="$xs"
                position="relative"
              >
                <ContentReference reference={references[0]} />
              </View>
            </View>
          )}
        </View>
        <DetailView.MetaData post={post} />
      </DetailView.Header>
    </DetailView>
  );
}
