import {
  extractContentTypesFromPost,
  findFirstImageBlock,
  isImagePost,
  isReferencePost,
  isTextPost,
  textPostIsLinkedImage,
  tiptap,
} from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { Link } from 'packages/shared/dist/urbit';
import { useCallback, useMemo } from 'react';
import {
  Dimensions,
  Image,
  ImageBackground,
  TouchableOpacity,
} from 'react-native';
import { getTokenValue } from 'tamagui';

import { LinearGradient, Text, View, YStack } from '../../core';
import AuthorRow from '../AuthorRow';
import ChatContent from '../ChatMessage/ChatContent';
import ContentReference from '../ContentReference';
import Pressable from '../Pressable';

export default function GalleryPost({
  post,
  onPress,
  onLongPress,
  onPressImage,
  detailView = false,
}: {
  post: db.Post;
  onPress?: (post: db.Post) => void;
  onLongPress?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  detailView?: boolean;
}) {
  // We want to show two posts per row in the gallery view, each with a margin of 16
  // and padding of 16 on all sides. This means that the width of each post should be
  // (windowWidth - 2 * padding - 2 * margin) / 2 = (windowWidth - 64) / 2
  const postPadding = getTokenValue('$l');
  const postMargin = getTokenValue('$l');
  const HEIGHT_AND_WIDTH =
    (Dimensions.get('window').width - 2 * postPadding - 2 * postMargin) / 2;
  // We want the content of the detail view to take up 70% of the screen height
  const HEIGHT_DETAIL_VIEW_CONTENT = Dimensions.get('window').height * 0.7;
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

  const linkedImage = useMemo(
    () =>
      textPostIsJustLinkedImage ? (inlines[0] as Link).link.href : undefined,
    [inlines, textPostIsJustLinkedImage]
  );

  const handleImagePressed = useCallback(
    (uri: string) => {
      onPressImage?.(post, uri);
    },
    [onPressImage, post]
  );

  if (!postIsJustImage && !postIsJustText && !postIsJustReference) {
    return null;
  }

  return (
    <Pressable
      onPress={() => onPress?.(post)}
      onLongPress={() => onLongPress?.(post)}
    >
      <View padding="$m" key={post.id} position="relative" alignItems="center">
        {(postIsJustImage || textPostIsJustLinkedImage) &&
          (detailView ? (
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
                  resizeMode="cover"
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
          ) : (
            <ImageBackground
              source={{ uri: postIsJustImage ? image!.src : linkedImage }}
              style={{
                width: HEIGHT_AND_WIDTH,
                height: HEIGHT_AND_WIDTH,
              }}
              imageStyle={{
                borderRadius: 12,
              }}
            >
              {!detailView && (
                <View position="absolute" bottom="$l">
                  <AuthorRow
                    author={post.author}
                    authorId={post.authorId}
                    sent={post.sentAt}
                    type={post.type}
                    width={HEIGHT_AND_WIDTH}
                  />
                </View>
              )}
            </ImageBackground>
          ))}
        {postIsJustText && !textPostIsJustLinkedImage && (
          <View
            backgroundColor="$background"
            borderRadius="$l"
            padding="$l"
            width={detailView ? WIDTH_DETAIL_VIEW_CONTENT : HEIGHT_AND_WIDTH}
            height={detailView ? HEIGHT_DETAIL_VIEW_CONTENT : HEIGHT_AND_WIDTH}
          >
            <View
              height={
                detailView ? '100%' : HEIGHT_AND_WIDTH - getTokenValue('$2xl')
              }
              width="100%"
              overflow="hidden"
              paddingBottom="$xs"
              position="relative"
            >
              <ChatContent
                viewMode={detailView ? undefined : 'block'}
                post={post}
              />
              {!detailView && (
                <LinearGradient
                  colors={['$transparentBackground', '$background']}
                  start={{ x: 0, y: 0.4 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: HEIGHT_AND_WIDTH - getTokenValue('$2xl'),
                  }}
                />
              )}
            </View>
            {!detailView && (
              <View position="absolute" bottom="$l">
                <AuthorRow
                  author={post.author}
                  authorId={post.authorId}
                  sent={post.sentAt}
                  type={post.type}
                  width={HEIGHT_AND_WIDTH}
                />
              </View>
            )}
          </View>
        )}
        {postIsJustReference && (
          <View
            width={detailView ? WIDTH_DETAIL_VIEW_CONTENT : HEIGHT_AND_WIDTH}
            height={detailView ? HEIGHT_DETAIL_VIEW_CONTENT : HEIGHT_AND_WIDTH}
            borderRadius="$l"
            padding="$m"
            overflow="hidden"
          >
            <View
              height={
                detailView ? '100%' : HEIGHT_AND_WIDTH - getTokenValue('$2xl')
              }
              width="100%"
              overflow="hidden"
              paddingBottom="$xs"
              position="relative"
            >
              <ContentReference
                viewMode={detailView ? undefined : 'block'}
                reference={references[0]}
              />
              {!detailView && (
                <LinearGradient
                  colors={['$transparentBackground', '$background']}
                  start={{ x: 0, y: 0.4 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: HEIGHT_AND_WIDTH - 24,
                  }}
                />
              )}
              <LinearGradient
                colors={['$transparentBackground', '$background']}
                start={{ x: 0, y: 0.4 }}
                end={{ x: 0, y: 1 }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: HEIGHT_AND_WIDTH - getTokenValue('$2xl'),
                }}
              />
            </View>
            <View position="absolute" bottom="$l">
              <AuthorRow
                author={post.author}
                authorId={post.authorId}
                sent={post.sentAt}
                type={post.type}
                width={HEIGHT_AND_WIDTH}
              />
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}
