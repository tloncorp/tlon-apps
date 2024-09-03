import { tiptap, usePostMeta } from '@tloncorp/shared/dist';
import { Dimensions } from 'react-native';
import { Text, View, YStack } from 'tamagui';

import { ContentReferenceLoader } from '../ContentReference/ContentReference';
import ContentRenderer from '../ContentRenderer';
import { Icon } from '../Icon';
import { Image } from '../Image';
import { DetailView, DetailViewProps } from './DetailView';

export default function GalleryDetailView({
  post,
  editingPost,
  setEditingPost,
  editPost,
  sendReply,
  groupMembers,
  posts,
  onPressImage,
  storeDraft,
  clearDraft,
  getDraft,
  goBack,
  onPressRetry,
  onPressDelete,
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
    isLink,
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
      editingPost={editingPost}
      setEditingPost={setEditingPost}
      editPost={editPost}
      sendReply={sendReply}
      groupMembers={groupMembers}
      posts={posts}
      onPressImage={onPressImage}
      storeDraft={storeDraft}
      clearDraft={clearDraft}
      getDraft={getDraft}
      goBack={goBack}
      onPressRetry={onPressRetry}
      onPressDelete={onPressDelete}
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
              borderColor="$border"
              borderTopWidth={1}
              borderBottomWidth={1}
              backgroundColor="$secondaryBackground"
              padding="$l"
              width={WIDTH_DETAIL_VIEW_CONTENT}
              height="auto"
            >
              <View
                overflow="hidden"
                paddingBottom="$xs"
                position="relative"
                flexDirection="row"
                alignItems="center"
              >
                {isLink && <Icon type="Link" />}
                <ContentRenderer post={post} />
              </View>
            </View>
          )}
          {(isReference || isRefInText) && (
            <View
              backgroundColor="$secondaryBackground"
              borderColor="$border"
              borderTopWidth={1}
              borderBottomWidth={1}
              width={WIDTH_DETAIL_VIEW_CONTENT}
              height="auto"
              overflow="hidden"
            >
              <View overflow="hidden" position="relative">
                <ContentReferenceLoader
                  reference={references[0]}
                  viewMode="block"
                />
              </View>
            </View>
          )}
        </View>
        <View paddingBottom="$xl">
          <DetailView.MetaData post={post} />
        </View>
      </DetailView.Header>
    </DetailView>
  );
}
