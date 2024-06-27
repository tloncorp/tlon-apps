import { tiptap, usePostMeta } from '@tloncorp/shared/dist';
import { Dimensions } from 'react-native';

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
  markRead,
}: DetailViewProps) {
  // We want the content of the detail view to take up 70% of the screen height
  const HEIGHT_DETAIL_VIEW_CONTENT = Dimensions.get('window').height * 0.5;
  // We want the content of the detail view to take up 100% of the screen width
  const WIDTH_DETAIL_VIEW_CONTENT = Dimensions.get('window').width;

  const {
    inlines,
    references,
    isText,
    isImage,
    isReference,
    isLinkedImage,
    isRefInText,
    image,
    linkedImage,
  } = usePostMeta(post);

  if (!isImage && !isText && !isReference && !isRefInText) {
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
      markRead={markRead}
    >
      <DetailView.Header replyCount={post.replyCount ?? 0}>
        <View paddingHorizontal="$xl" key={post.id} alignItems="center">
          {(isImage || isLinkedImage) && (
            <YStack gap="$s">
              <Image
                source={{
                  uri: isImage ? image!.src : linkedImage,
                }}
                contentFit="contain"
                width={WIDTH_DETAIL_VIEW_CONTENT}
                height={HEIGHT_DETAIL_VIEW_CONTENT}
              />
              {inlines.length > 0 && !isLinkedImage && (
                <View paddingHorizontal="$m">
                  <Text>{tiptap.inlineToString(inlines[0])}</Text>
                </View>
              )}
            </YStack>
          )}
          {isText && !isLinkedImage && !isRefInText && (
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
          {(isReference || isRefInText) && (
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
