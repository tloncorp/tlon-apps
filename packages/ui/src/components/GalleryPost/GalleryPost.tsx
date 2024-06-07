import { usePostMeta } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
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

  const {
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
      postIsJustText: isText,
      postIsJustImage: isImage,
      postIsJustReference: isReference,
      textPostIsJustReference: isRefInText,
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
        {(isImage || isLinkedImage) && (
          <ImageBackground
            source={{ uri: isImage ? image!.src : linkedImage }}
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
        {isText && !isLinkedImage && !isRefInText && (
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
        {(isReference || isRefInText) && (
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
