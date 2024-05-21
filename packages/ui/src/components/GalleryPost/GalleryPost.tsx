import {
  extractContentTypesFromPost,
  findFirstImageBlock,
  isImagePost,
  isReferencePost,
  isTextPost,
  textPostIsLinkedImage,
} from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { Link } from 'packages/shared/dist/urbit';
import { useMemo } from 'react';
import { Dimensions, ImageBackground } from 'react-native';

import { LinearGradient, View } from '../../core';
import ChatContent from '../ChatMessage/ChatContent';
import ContentReference from '../ContentReference';
import Pressable from '../Pressable';
import GalleryAuthorRow from './GalleryAuthorRow';

const HEIGHT_AND_WIDTH = (Dimensions.get('window').width - 46) / 2;

export default function GalleryPost({
  post,
  onPress,
  onLongPress,
}: {
  post: db.Post;
  onPress?: () => void;
  onLongPress?: (post: db.Post) => void;
}) {
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

  if (!postIsJustImage && !postIsJustText && !postIsJustReference) {
    return null;
  }

  return (
    <Pressable onPress={onPress} onLongPress={() => onLongPress?.(post)}>
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
              <GalleryAuthorRow
                author={post.author}
                authorId={post.authorId}
                sent={post.sentAt}
                width={HEIGHT_AND_WIDTH}
              />
            </View>
          </ImageBackground>
        )}
        {postIsJustText && !textPostIsJustLinkedImage && (
          <View
            backgroundColor="$background"
            borderRadius="$l"
            padding="$l"
            width={HEIGHT_AND_WIDTH}
            height={HEIGHT_AND_WIDTH}
          >
            <View
              height={HEIGHT_AND_WIDTH - 24}
              width="100%"
              overflow="hidden"
              paddingBottom="$xs"
              position="relative"
            >
              <ChatContent viewMode="block" post={post} />
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
            </View>
            <View position="absolute" bottom="$l">
              <GalleryAuthorRow
                author={post.author}
                authorId={post.authorId}
                sent={post.sentAt}
                width={HEIGHT_AND_WIDTH}
              />
            </View>
          </View>
        )}
        {postIsJustReference && (
          <View
            width={HEIGHT_AND_WIDTH}
            height={HEIGHT_AND_WIDTH}
            borderRadius="$l"
            padding="$m"
            overflow="hidden"
          >
            <View
              height={HEIGHT_AND_WIDTH - 24}
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
                  height: HEIGHT_AND_WIDTH - 24,
                }}
              />
            </View>
            <View position="absolute" bottom="$l">
              <GalleryAuthorRow
                author={post.author}
                authorId={post.authorId}
                sent={post.sentAt}
                width={HEIGHT_AND_WIDTH}
              />
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}
