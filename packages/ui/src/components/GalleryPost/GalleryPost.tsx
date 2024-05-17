import {
  ContentReference as ContentReferenceType,
  PostContent,
} from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import {
  Image as ImageBlock,
  VerseBlock,
  VerseInline,
} from 'packages/shared/dist/urbit';
import { useMemo } from 'react';
import { Dimensions, ImageBackground } from 'react-native';

import { LinearGradient, View, XStack } from '../../core';
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
  const content = useMemo(
    () => JSON.parse(post.content as string) as PostContent,
    [post.content]
  );

  const inlines = useMemo(
    () =>
      content !== null
        ? (content.filter((c) => 'inline' in c) as VerseInline[])
        : [],
    [content]
  );
  const references = useMemo(
    () =>
      content !== null
        ? (content.filter(
            (s) => 'type' in s && s.type == 'reference'
          ) as ContentReferenceType[])
        : [],
    [content]
  );
  const blocks = useMemo(
    () =>
      content !== null
        ? (content.filter((c) => 'block' in c) as VerseBlock[])
        : [],
    [content]
  );
  const inlineLength = useMemo(() => inlines.length, [inlines]);
  const referenceLength = useMemo(() => references.length, [references]);
  const blockLength = useMemo(() => blocks.length, [blocks]);

  if (inlineLength === 0 && referenceLength === 0 && blockLength === 0) {
    return null;
  }

  const isImagePost =
    blocks.length === 1 && blocks.some((b) => 'image' in b.block);
  const isTextPost =
    blocks.length === 0 && inlines.length > 0 && references.length === 0;
  const isReferencePost =
    blocks.length === 0 && inlines.length === 1 && references.length === 1;
  const image = isImagePost
    ? (blocks.find((b) => 'image' in b.block)?.block as ImageBlock).image
    : null;

  if (references.length > 0) {
    console.log('reference post', {
      post,
      content,
      inlines,
      references,
      blocks,
      isReferencePost,
      inlineLength,
      isTextPost,
    });
  }

  return (
    <Pressable onPress={onPress} onLongPress={() => onLongPress?.(post)}>
      <View key={post.id} position="relative" alignItems="center">
        {isImagePost && (
          <ImageBackground
            source={{ uri: image!.src }}
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
        {isTextPost && (
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
              <ChatContent isGalleryPost story={content} />
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
        {isReferencePost && (
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
              <ContentReference inGalleryPost reference={references[0]} />
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
