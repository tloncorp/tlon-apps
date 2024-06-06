import { extractContentTypesFromPost, utils } from '@tloncorp/shared';
import {
  Block,
  Code,
  Header,
  HeaderLevel,
  Listing,
  isImage,
} from '@tloncorp/shared/dist/urbit/channel';
import {
  Inline,
  isBlockCode,
  isBlockquote,
  isBold,
  isBreak,
  isCode,
  isHeader,
  isInlineCode,
  isItalics,
  isLink,
  isListItem,
  isListing,
  isShip,
  isStrikethrough,
  isTask,
} from '@tloncorp/shared/dist/urbit/content';
import { ImageLoadEventData } from 'expo-image';
import { truncate } from 'lodash';
import { PostContent } from 'packages/shared/dist/api';
import { Post, PostDeliveryStatus } from 'packages/shared/dist/db';
import {
  ComponentProps,
  ReactElement,
  ReactNode,
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { StyleSheet, TextStyle, TouchableOpacity } from 'react-native';
import hoon from 'refractor/lang/hoon';
import { refractor } from 'refractor/lib/common.js';

import {
  ColorTokens,
  Image,
  ScrollView,
  Text,
  View,
  XStack,
  YStack,
} from '../core';
import ChatEmbedContent from './ChatMessage/ChatEmbedContent';
import { ChatMessageDeliveryStatus } from './ChatMessage/ChatMessageDeliveryStatus';
import ContactName from './ContactName';
import ContentReference from './ContentReference';

refractor.register(hoon);

function ShipMention(props: ComponentProps<typeof ContactName>) {
  return (
    <ContactName
      onPress={() => {}}
      fontWeight={'500'}
      color="$positiveActionText"
      showNickname
      {...props}
    />
  );
}

function ListingContent({ content }: { content: Listing }) {
  if (isListItem(content)) {
    return (
      <View>
        {content.item.map((item, i) => (
          <InlineContent key={`${i}-${item}`} inline={item} />
        ))}
      </View>
    );
  }

  if (content.list.type === 'tasklist') {
    return (
      <View>
        {content.list.contents.map((item, i) => (
          <XStack key={i}>
            <InlineContent key={`${i}-${item}`} inline={item} />
          </XStack>
        ))}
        <View style={{ listStyleType: 'none' }}>
          {content.list.items.map((con, i) => (
            <ListingContent key={i} content={con} />
          ))}
        </View>
      </View>
    );
  }

  const isOrderedList = content.list.type === 'ordered';

  return (
    <View>
      {content.list.contents.map((item, i) => (
        <XStack key={i}>
          <InlineContent key={`${i}-${item}`} inline={item} />
        </XStack>
      ))}
      <View>
        {content.list.items.map((con, i) => (
          <XStack key={i} alignItems="flex-start">
            <View marginRight="$m">
              {isOrderedList ? (
                <InlineContent inline={`${i + 1}.`} />
              ) : (
                <InlineContent inline="•" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <ListingContent key={i} content={con} />
            </View>
          </XStack>
        ))}
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  h1: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  h2: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  h3: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  h4: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  h5: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  h6: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});

function getHeaderStyle(tag: HeaderLevel) {
  switch (tag) {
    case 'h1':
      return headerStyles.h1;
    case 'h2':
      return headerStyles.h2;
    case 'h3':
      return headerStyles.h3;
    case 'h4':
      return headerStyles.h4;
    case 'h5':
      return headerStyles.h5;
    case 'h6':
      return headerStyles.h6;
    default:
      return headerStyles.h1;
  }
}

function HeaderText({ header }: Header) {
  const { tag, content } = header;
  const style = getHeaderStyle(tag);

  return (
    <Text style={style}>
      {content.map((con, i) => (
        <InlineContent key={`${con}-${i}`} inline={con} />
      ))}
    </Text>
  );
}

function getStyles(className: string[] | undefined) {
  if (!className) {
    return null;
  }

  const styles = StyleSheet.create({
    'token comment': {
      color: '#999',
    },
    'token block-comment': {
      color: '#999',
    },
    'token prolog': {
      color: '#999',
    },
    'token doctype': {
      color: '#999',
    },
    'token cdata': {
      color: '#999',
    },
    'token punctuation': {
      color: '#ccc',
    },
    'token tag': {
      color: '#e2777a',
    },
    'token attr-name': {
      color: '#e2777a',
    },
    'token namespace': {
      color: '#e2777a',
    },
    'token deleted': {
      color: '#e2777a',
    },
    'token function-name': {
      color: '#6196cc',
    },
    'token boolean': {
      color: '#f08d49',
    },
    'token number': {
      color: '#f08d49',
    },
    'token function': {
      color: '#f08d49',
    },
    'token property': {
      color: '#f8c555',
    },
    'token class-name': {
      color: '#f8c555',
    },
    'token constant': {
      color: '#f8c555',
    },
    'token symbol': {
      color: '#f8c555',
    },
    'token selector': {
      color: '#cc99cd',
    },
    'token important': {
      color: '#cc99cd',
      fontWeight: 'bold',
    },
    'token atrule': {
      color: '#cc99cd',
    },
    'token keyword': {
      color: '#cc99cd',
    },
    'token builtin': {
      color: '#cc99cd',
    },
    'token string': {
      color: '#7ec699',
    },
    'token char': {
      color: '#7ec699',
    },
    'token attr-value': {
      color: '#7ec699',
    },
    'token regex': {
      color: '#7ec699',
    },
    'token variable': {
      color: '#7ec699',
    },
    'token operator': {
      color: '#67cdcc',
    },
    'token entity': {
      color: '#67cdcc',
      // cursor: 'help',
    },
    'token url': {
      color: '#67cdcc',
    },
    'token bold': {
      fontWeight: 'bold',
    },
    'token italic': {
      fontStyle: 'italic',
    },
    'token inserted': {
      color: 'green',
    },
  });

  const combinedClassNames = className.join(' ');

  return styles[combinedClassNames as keyof typeof styles] as TextStyle;
}

type TreeNodeType = 'text' | 'element' | 'root';
type TreeNode = {
  type: TreeNodeType;
  value: string;
  tagName: string;
  children: TreeNode[];
  properties: { className: string[] };
};

function hastToReactNative(tree: TreeNode, index?: number): ReactNode {
  if ('type' in tree && tree.type === 'text') {
    return tree.value;
  }

  if ('type' in tree && tree.type === 'element') {
    const children = (tree.children || []).map((child: TreeNode) =>
      hastToReactNative(child)
    );

    const classNames = tree.properties.className
      ? tree.properties.className.join(' ')
      : tree.tagName;
    const key = index ? `${classNames}-${index}` : classNames;

    return (
      <Text key={key} style={getStyles(tree.properties.className)}>
        {children}
      </Text>
    );
  }

  if ('type' in tree && tree.type === 'root') {
    return tree.children.map((child: TreeNode, i: number) =>
      hastToReactNative(child, i)
    );
  }

  return null;
}

function CodeContent({ code }: Code) {
  const { lang, code: content } = code;
  const tree = refractor.highlight(content, lang) as TreeNode;
  const element = hastToReactNative(tree);

  return (
    <ScrollView horizontal>
      <View
        backgroundColor="$secondaryBackground"
        borderRadius="$s"
        padding="$s"
      >
        <Text fontFamily="$mono" color="$primaryText" lineHeight="$m">
          {element}
        </Text>
      </View>
    </ScrollView>
  );
}

export function InlineContent({
  inline,
  color = '$primaryText',
  viewMode = 'chat',
  onPressImage,
  onLongPress,
}: {
  inline: Inline | null;
  color?: ColorTokens;
  viewMode?: PostViewMode;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
}) {
  if (inline === null) {
    return null;
  }
  if (typeof inline === 'string') {
    if (utils.isSingleEmoji(inline)) {
      return (
        <Text paddingTop="$xl" lineHeight="$m" fontSize="$xl">
          {inline}
        </Text>
      );
    }
    return (
      <Text
        color={color}
        lineHeight="$m"
        fontSize={viewMode === 'block' ? '$s' : '$m'}
      >
        {inline}
      </Text>
    );
  }

  if (isBold(inline)) {
    return (
      <>
        {inline.bold.map((s, k) => (
          <Text fontSize="$m" lineHeight="$m" fontWeight="bold" key={k}>
            <InlineContent inline={s} color={color} />
          </Text>
        ))}
      </>
    );
  }

  if (isItalics(inline)) {
    return (
      <>
        {inline.italics.map((s, k) => (
          <Text fontSize="$m" lineHeight="$m" fontStyle="italic" key={k}>
            <InlineContent inline={s} color={color} />
          </Text>
        ))}
      </>
    );
  }

  if (isStrikethrough(inline)) {
    return (
      <>
        {inline.strike.map((s, k) => (
          <Text
            fontSize="$m"
            lineHeight="$m"
            textDecorationLine="line-through"
            key={k}
          >
            <InlineContent inline={s} color={color} />
          </Text>
        ))}
      </>
    );
  }

  if (isInlineCode(inline)) {
    return (
      <Text
        fontFamily="$mono"
        color={color}
        backgroundColor="$secondaryBackground"
        padding="$xs"
        borderRadius="$s"
        lineHeight="$m"
      >
        {inline['inline-code']}
      </Text>
    );
  }

  if (isBlockCode(inline)) {
    return (
      <View
        backgroundColor="$secondaryBackground"
        padding="$m"
        borderRadius="$s"
        marginBottom="$m"
      >
        <Text
          fontFamily="$mono"
          padding="$m"
          borderRadius="$s"
          color={color}
          backgroundColor="$secondaryBackground"
          lineHeight="$m"
        >
          {inline.code}
        </Text>
      </View>
    );
  }

  if (isLink(inline)) {
    return (
      <ChatEmbedContent
        viewMode={viewMode}
        url={inline.link.href}
        content={inline.link.content}
        onPressImage={onPressImage}
        onLongPress={onLongPress}
      />
    );
  }

  if (isBreak(inline)) {
    return <Text height="$s" />;
  }

  if (isShip(inline)) {
    return <ShipMention userId={inline.ship} />;
  }

  if (isTask(inline)) {
    return (
      <XStack>
        <Text color={color} fontSize="$m" lineHeight="$m" marginRight="$m">
          {inline.task.checked ? '☑' : '☐'}
        </Text>
        {inline.task.content.map((s, k) => (
          <InlineContent key={k} inline={s} color={color} />
        ))}
      </XStack>
    );
  }

  console.error('Unhandled message type:', { inline });
  return (
    <Text color="$primaryText" fontWeight="$l">
      This content cannot be rendered, unhandled message type.
    </Text>
  );
}

export function BlockContent({
  block,
  onPressImage,
  onLongPress,
}: {
  block: Block;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
}) {
  const [aspect, setAspect] = useState<number | null>(() => {
    return isImage(block) && block.image.height && block.image.width
      ? block.image.width / block.image.height
      : null;
  });

  const handleImageLoaded = useCallback((e: ImageLoadEventData) => {
    setAspect(e.source.width / e.source.height);
  }, []);

  if (isImage(block)) {
    const isVideoFile = utils.VIDEO_REGEX.test(block.image.src);

    if (isVideoFile) {
      return (
        <ChatEmbedContent url={block.image.src} content={block.image.src} />
      );
    }

    return (
      <TouchableOpacity
        onPress={onPressImage ? () => onPressImage(block.image.src) : undefined}
        onLongPress={onLongPress}
        activeOpacity={0.9}
      >
        <Image
          source={{
            uri: block.image.src,
            width: block.image.height,
            height: block.image.width,
          }}
          alt={block.image.alt}
          borderRadius="$m"
          onLoad={handleImageLoaded}
          width={200}
          backgroundColor={'$secondaryBackground'}
          height={aspect ? 200 / aspect : 100}
        />
      </TouchableOpacity>
    );
  }

  if (isListing(block)) {
    return <ListingContent content={block.listing} />;
  }

  if (isHeader(block)) {
    return <HeaderText header={block.header} />;
  }

  if (isCode(block)) {
    return <CodeContent code={block.code} />;
  }

  if ('rule' in block) {
    return <View borderBottomWidth={1} borderColor="$border" />;
  }

  console.error('Unhandled message type:', { block });
  return (
    <Text fontWeight="$l">
      This content cannot be rendered, unhandled message type.
    </Text>
  );
}

const LineRenderer = memo(
  ({
    inlines,
    onPressImage,
    onLongPress,
    color = '$primaryText',
    isNotice = false,
    viewMode = 'chat',
  }: {
    inlines: Inline[];
    onLongPress?: () => void;
    onPressImage?: (src: string) => void;
    color?: ColorTokens;
    isNotice?: boolean;
    viewMode?: PostViewMode;
  }) => {
    const inlineElements: ReactElement[][] = [];
    let currentLine: ReactElement[] = [];

    // return <View height={40} width={200} backgroundColor="orange" />;

    inlines.forEach((inline, index) => {
      if (isBreak(inline)) {
        inlineElements.push(currentLine);
        currentLine = [];
      } else if (typeof inline === 'string') {
        if (utils.isSingleEmoji(inline)) {
          currentLine.push(
            <Text
              key={`emoji-${inline}-${index}`}
              fontSize="$xl"
              flexWrap="wrap"
            >
              {inline}
            </Text>
          );
        } else {
          currentLine.push(
            <Text
              key={`string-${inline}-${index}`}
              color={isNotice ? '$secondaryText' : color}
              fontSize={viewMode === 'block' || isNotice ? '$s' : '$m'}
              lineHeight="$m"
            >
              {inline}
            </Text>
          );
        }
      } else if (isBlockquote(inline)) {
        currentLine.push(
          <YStack
            key={`blockquote-${index}`}
            borderLeftWidth={2}
            borderColor="$border"
            paddingLeft="$l"
          >
            {Array.isArray(inline.blockquote) ? (
              <LineRenderer
                inlines={inline.blockquote}
                color="$secondaryText"
              />
            ) : (
              // not clear if this is necessary
              <InlineContent
                inline={inline.blockquote}
                color="$secondaryText"
              />
            )}
          </YStack>
        );
        inlineElements.push(currentLine);
        currentLine = [];
      } else if (isShip(inline)) {
        currentLine.push(
          <ShipMention
            key={`ship-${index}`}
            userId={inline.ship}
            fontSize={isNotice ? '$s' : 'unset'}
          />
        );
      } else {
        currentLine.push(
          <InlineContent
            viewMode={viewMode}
            key={`inline-${index}`}
            inline={inline}
            color={color}
            onPressImage={onPressImage}
            onLongPress={onLongPress}
          />
        );
      }
    });

    if (currentLine.length > 0) {
      inlineElements.push(currentLine);
    }

    return (
      <>
        {inlineElements.map((line, index) => {
          if (line.length === 0) {
            return (
              <XStack key={`line-${index}`}>
                <Text height="$xl">{'\n'}</Text>
              </XStack>
            );
          }

          return (
            <Text
              fontSize={viewMode === 'block' ? '$s' : '$m'}
              key={`line-${index}`}
              flexWrap="wrap"
              lineHeight="$m"
            >
              {line}
            </Text>
          );
        })}
      </>
    );
  }
);

LineRenderer.displayName = 'LineRenderer';

export type PostViewMode = 'chat' | 'block' | 'note';

export default function ContentRenderer({
  post,
  shortened = false,
  isNotice = false,
  deliveryStatus,
  onPressImage,
  onLongPress,
  isEdited = false,
  viewMode = 'chat',
}: {
  post: Post | { type: 'chat' | 'diary' | 'gallery'; id: string; content: any };
  shortened?: boolean;
  isNotice?: boolean;
  deliveryStatus?: PostDeliveryStatus | null;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
  isEdited?: boolean;
  viewMode?: PostViewMode;
}) {
  const { inlines, blocks, references, story } = useMemo(
    () => extractContentTypesFromPost(post),
    [post]
  );

  // console.log(`ContentRenderer: ${post.id} inlines`, inlines);

  const firstInlineIsMention = useMemo(
    () =>
      inlines.length > 0 &&
      typeof inlines[0] === 'object' &&
      'ship' in inlines[0],
    [inlines]
  );
  const shortenedInlines = useMemo(
    () =>
      inlines.length > 1
        ? firstInlineIsMention
          ? inlines
              .map((i) =>
                typeof i === 'string'
                  ? truncate(i, { length: 100, omission: '' })
                  : i
              )
              .slice(0, 2)
              .concat('...')
          : inlines
              .map((i) =>
                typeof i === 'string'
                  ? truncate(i, { length: 100, omission: '' })
                  : i
              )
              .slice(0, 1)
              .concat('...')
        : [],
    [firstInlineIsMention, inlines]
  );
  const blockContent = useMemo(
    () =>
      blocks.sort((a, b) => {
        // Sort images to the end
        if (isImage(a) && !isImage(b)) {
          return 1;
        }
        if (!isImage(a) && isImage(b)) {
          return -1;
        }
        return 0;
      }),
    [blocks]
  );

  if (blocks.length === 0 && inlines.length === 0 && references.length === 0) {
    console.log(`bl: ContentRenderer: ${post.id} we got nothin, ${inlines}`);
    return null;
  }

  if (post.type === 'note' && story) {
    // Notes are always rendered with interleaved content

    return (
      <YStack width="100%">
        {story.map((s, k) => {
          if ('block' in s) {
            return <BlockContent key={k} block={s.block} />;
          }

          if ('type' in s && s.type === 'reference') {
            return <ContentReference key={k} reference={s} />;
          }

          if ('inline' in s) {
            return (
              <LineRenderer
                key={k}
                inlines={s.inline}
                isNotice={isNotice}
                onPressImage={onPressImage}
                onLongPress={onLongPress}
                viewMode={viewMode}
              />
            );
          }
        })}
      </YStack>
    );
  }

  console.log('bl: made it here?');

  return (
    <YStack width="100%">
      {!shortened && references.length > 0 ? (
        <YStack gap="$s" paddingBottom="$l">
          {references.map((ref, key) => {
            return <ContentReference key={key} reference={ref} />;
          })}
        </YStack>
      ) : null}
      {!shortened && blocks.length > 0 ? (
        <YStack>
          {blockContent
            .filter((a) => !!a)
            .map((block, key) => {
              return (
                <BlockContent
                  key={key}
                  block={block}
                  onPressImage={onPressImage}
                  onLongPress={onLongPress}
                />
              );
            })}
        </YStack>
      ) : null}
      <XStack justifyContent="space-between" alignItems="flex-start">
        {inlines.length > 0 ? (
          <View flexGrow={1} flexShrink={1}>
            <LineRenderer
              inlines={shortened ? shortenedInlines : inlines}
              isNotice={isNotice}
              onPressImage={onPressImage}
              onLongPress={onLongPress}
              viewMode={viewMode}
            />
          </View>
        ) : null}
        {isEdited ? (
          <Text color="$tertiaryText" fontSize="$xs" flexWrap="nowrap">
            Edited
          </Text>
        ) : null}
        {deliveryStatus ? (
          <View flexShrink={1}>
            <ChatMessageDeliveryStatus status={deliveryStatus} />
          </View>
        ) : null}
      </XStack>
    </YStack>
  );
}
