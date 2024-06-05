import {
  extractContentTypesFromPost,
  findFirstImageBlock,
  isImagePost,
  isReferencePost,
  isTextPost,
  textPostIsLinkedImage,
  textPostIsReference,
} from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { Link } from '@tloncorp/shared/dist/urbit';
import { useMemo } from 'react';
import { Dimensions, ImageBackground } from 'react-native';
import { getTokenValue } from 'tamagui';

import { LinearGradient, Text, View } from '../../core';
import AuthorRow from '../AuthorRow';
import ContentReference from '../ContentReference';
import ContentRenderer from '../ContentRenderer';
import Pressable from '../Pressable';

export default function GalleryPost({
  post,
  onPress,
  onLongPress,
}: {
  post: db.Post;
  onPress?: (post: db.Post) => void;
  onLongPress?: (post: db.Post) => void;
}) {
  // We want to show two posts per row in the gallery view, each with a margin of 16
  // and padding of 16 on all sides. This means that the width of each post should be
  // (windowWidth - 2 * padding - 2 * margin) / 2 = (windowWidth - 64) / 2
  const postPadding = getTokenValue('$l');
  const postMargin = getTokenValue('$l');
  const HEIGHT_AND_WIDTH =
    (Dimensions.get('window').width - 2 * postPadding - 2 * postMargin) / 2;

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
      textPostIsJustLinkedImage ? (inlines[0] as Link).link.href : undefined,
    [inlines, textPostIsJustLinkedImage]
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
      postIsJustText,
      postIsJustImage,
      postIsJustReference,
      textPostIsJustReference,
    });

    return (
      <View padding="$m" key={post.id} position="relative" alignItems="center">
        <Text>Unsupported post type</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPress?.(post)}
      onLongPress={() => onLongPress?.(post)}
    >
      <View padding="$m" key={post.id} position="relative" alignItems="center">
        {(postIsJustImage || textPostIsJustLinkedImage) && (
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
            <View position="absolute" bottom="$l">
              <AuthorRow
                author={post.author}
                authorId={post.authorId}
                sent={post.sentAt}
                type={post.type}
                width={HEIGHT_AND_WIDTH}
              />
            </View>
          </ImageBackground>
        )}
        {postIsJustText &&
          !textPostIsJustLinkedImage &&
          !textPostIsJustReference && (
            <View
              backgroundColor="$secondaryBackground"
              borderRadius="$l"
              padding="$l"
              width={HEIGHT_AND_WIDTH}
              height={HEIGHT_AND_WIDTH}
            >
              <View
                height={HEIGHT_AND_WIDTH - getTokenValue('$2xl')}
                width="100%"
                overflow="hidden"
                paddingBottom="$xs"
                position="relative"
              >
                <ContentRenderer viewMode="block" post={post} />
                <LinearGradient
                  colors={['$transparentBackground', '$secondaryBackground']}
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
        {(postIsJustReference || textPostIsJustReference) && (
          <View
            width={HEIGHT_AND_WIDTH}
            height={HEIGHT_AND_WIDTH}
            borderRadius="$l"
            padding="$m"
            overflow="hidden"
          >
            <View
              height={HEIGHT_AND_WIDTH - getTokenValue('$2xl')}
              width="100%"
              overflow="hidden"
              paddingBottom="$xs"
              position="relative"
            >
              <ContentReference viewMode="block" reference={references[0]} />
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
