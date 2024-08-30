import { Post } from '@tloncorp/shared/dist/db';
import { ImageLoadEventData } from 'expo-image';
import {
  ComponentProps,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Linking, TouchableOpacity } from 'react-native';
import {
  ColorTokens,
  View,
  XStack,
  YStack,
  createStyledContext,
  styled,
} from 'tamagui';

import { ContactName } from '../ContactNameV2';
import { ContentReferenceLoader } from '../ContentReference';
import { VideoEmbed } from '../Embed';
import { Image } from '../Image';
import { RawText, Text, TextProps } from '../TextV2';
import { CodeBlock } from './CodeBlock';
import type * as cn from './contentProcessor';
import { convertContent } from './contentProcessor';

export type PostViewMode =
  | 'chat'
  | 'block'
  | 'note'
  | 'activity'
  | 'attachment';

const ContentContext = createStyledContext<{
  viewMode: PostViewMode;
  isNotice: boolean;
}>({
  viewMode: 'chat',
  isNotice: false,
});

const ContentFrame = styled(YStack, {
  name: 'ContentFrame',
  width: '100%',
});

const ContentBlock = styled(View, {
  name: 'ContentBlock',
  context: ContentContext,
  padding: '$l',
  paddingLeft: 0,
  variants: {
    viewMode: {
      attachment: {
        padding: 0,
      },
    },
    isNotice: {
      true: {
        paddingLeft: '$4xl',
        paddingRight: '$4xl',
        width: '100%',
        alignItems: 'center',
      },
    },
  } as const,
});

const ShipMention = styled(ContactName, {
  name: 'ShipMention',
  context: ContentContext,
  color: '$positiveActionText',
  backgroundColor: '$positiveBackground',
});

function ListBlock({ block }: { block: cn.ListBlock }) {
  return <ListNode node={block.list} type={block.list.type ?? 'unordered'} />;
}

function ListNode({
  node,
}: {
  node: cn.ListNode;
  type: 'ordered' | 'unordered' | 'tasklist';
}) {
  return (
    <View flex={1}>
      {node.content.length ? (
        <LineRenderer trimmed={false} inlines={node.content} />
      ) : null}
      {node.children?.map((childNode, i) => (
        <XStack key={i} gap="$m">
          <ListItemMarker index={i} type={node.type ?? 'unordered'} />
          <ListNode key={i} node={childNode} type={node.type ?? 'unordered'} />
        </XStack>
      ))}
    </View>
  );
}

function ListItemMarker({
  type,
  index,
}: {
  type: 'ordered' | 'unordered' | 'tasklist';
  index: number;
}) {
  switch (type) {
    case 'ordered':
      return (
        <Text trimmed={false} size="$body">
          {index + 1}.
        </Text>
      );
    case 'unordered':
      return (
        <Text trimmed={false} size="$body">
          •︎
        </Text>
      );
    case 'tasklist':
      return (
        <Text trimmed={false} size="$body">
          {'\u2610'}
        </Text>
      );
  }
}

function ImageBlock({
  block,
  onPress,
  onLongPress,
}: {
  block: cn.ImageBlock;
  onPress?: (src: string) => void;
  onLongPress?: () => void;
}) {
  const [aspect, setAspect] = useState<number | null>(
    block.width / block.height
  );

  const handlePress = useCallback(() => {
    onPress?.(block.src);
  }, [block.src, onPress]);

  const handleImageLoaded = useCallback((e: ImageLoadEventData) => {
    setAspect(e.source.width / e.source.height);
  }, []);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={onLongPress}
      activeOpacity={0.9}
    >
      <Image
        source={{
          uri: block.src,
          width: block.height,
          height: block.width,
        }}
        alt={block.alt}
        borderRadius="$s"
        onLoad={handleImageLoaded}
        width={'100%'}
        aspectRatio={aspect ?? 1}
        backgroundColor={'$secondaryBackground'}
      />
    </TouchableOpacity>
  );
}

const Rule = styled(View, {
  borderBottomWidth: 1,
  borderColor: '$border',
});

const LineText = styled(Text, {
  color: '$primaryText',
  size: '$body',
  context: ContentContext,
  variants: {
    viewMode: {
      block: {
        size: '$label/m',
      },
      activity: {
        size: '$label/m',
      },
    } as Record<PostViewMode, TextProps>,
    isNotice: {
      true: {
        color: '$tertiaryText',
        size: '$label/m',
        textAlign: 'center',
      },
    },
  } as const,
});

function Blockquote({ block }: { block: cn.BlockquoteBlock }) {
  return (
    <YStack paddingLeft="$l">
      <BlockQuoteSideBorder />
      <LineRenderer inlines={block.content} color="$tertiaryText" />
    </YStack>
  );
}

const BlockQuoteSideBorder = styled(View, {
  name: 'BlockQuoteSideBorder',
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  borderRadius: 1,
  left: -2,
  backgroundColor: '$border',
});

export function Header({ block }: { block: cn.HeaderBlock }) {
  return (
    <HeaderText tag={block.level}>
      {block.children.map((con, i) => (
        <InlineContent key={`${con}-${i}`} inline={con} />
      ))}
    </HeaderText>
  );
}

const HeaderText = styled(Text, {
  variants: {
    tag: {
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
    },
  } as const,
});

// Renderers

const BigEmojiLine = styled(Text, {
  size: '$emoji/l',
  flexWrap: 'wrap',
  trimmed: true,
});

const InlineCode = styled(Text, {
  size: '$mono/m',
  color: '$primaryText',
  backgroundColor: '$secondaryBackground',
  padding: '$xs',
  borderRadius: '$s',
});

const InlineStrikethrough = styled(RawText, {
  textDecorationLine: 'line-through',
});

const InlineBold = styled(RawText, {
  fontWeight: 'bold',
});

const InlineItalic = styled(RawText, {
  fontStyle: 'italic',
});

function InlineLink({ node }: { node: cn.InlineLinkNode }) {
  const handlePress = useCallback(() => {
    Linking.openURL(node.href);
  }, [node.href]);
  return (
    <Text textDecorationLine="underline" onPress={handlePress}>
      {node.text || node.href}
    </Text>
  );
}

export function InlineContent({
  inline,
  color,
}: {
  inline: cn.InlineNode | null;
  color?: ColorTokens;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
}) {
  const { viewMode } = useContext(ContentContext);

  if (inline === null) {
    return null;
  }

  switch (inline.type) {
    case 'text':
      return color ? (
        <RawText color={color}>{inline.text}</RawText>
      ) : (
        inline.text
      );
    case 'style': {
      const StyleComponent = {
        bold: InlineBold,
        italic: InlineItalic,
        strikethrough: InlineStrikethrough,
        code: InlineCode,
      }[inline.style];
      return (
        <StyleComponent color={color}>
          {inline.children.map((child, i) => (
            <InlineContent inline={child} key={i} />
          ))}
        </StyleComponent>
      );
    }
    case 'mention':
      return <ShipMention contactId={inline.contactId} />;
    case 'lineBreak':
      return viewMode === 'note' ? '\n\n' : '\n';
    case 'link':
      return <InlineLink node={inline} />;
  }
}

/**
 * Renders a list of inlines as a single line of text (can be broken up by line breaks)
 */
const LineRenderer = memo(function LineRendererComponent({
  inlines,
  onPressImage,
  onLongPress,
  ...props
}: {
  inlines: cn.InlineNode[];
  onLongPress?: () => void;
  onPressImage?: (src: string) => void;
  color?: ColorTokens;
  trimmed?: boolean;
}) {
  return (
    // Spread color prop as undefined value will override when we don't want it to
    <LineText {...props}>
      {inlines.map((child, i) => {
        return (
          <InlineContent
            key={i}
            inline={child}
            onPressImage={onPressImage}
            onLongPress={onLongPress}
          />
        );
      })}
    </LineText>
  );
});

type ContentRendererProps = {
  post: Post;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
} & ComponentProps<typeof YStack>;

export function ContentRenderer({
  viewMode,
  shortened,
  ...props
}: ContentRendererProps & { viewMode?: PostViewMode; shortened?: boolean }) {
  return (
    <ContentContext.Provider
      viewMode={viewMode}
      isNotice={props.post.type === 'notice'}
    >
      {shortened ? (
        <ContentFrame {...props}>
          <LineText>{props.post.textContent?.slice(0, 100)}</LineText>
        </ContentFrame>
      ) : (
        <BaseContentRenderer {...props} />
      )}
    </ContentContext.Provider>
  );
}

function BaseContentRenderer({
  post,
  onPressImage,
  onLongPress,
  ...props
}: ContentRendererProps) {
  const { viewMode } = useContext(ContentContext);

  const convertedContent = useMemo(() => {
    if (!post.content) {
      return [];
    }
    const content = convertContent(post.content);
    // We don't want to render nested references
    return viewMode === 'attachment'
      ? content.filter((b) => b.type !== 'reference')
      : content;
  }, [post.content, viewMode]);

  return (
    <ContentFrame {...props}>
      {convertedContent.map((block, k) => {
        return (
          <ContentBlock key={k}>
            <BlockContent
              onPressImage={onPressImage}
              onLongPress={onLongPress}
              key={k}
              block={block}
            />
          </ContentBlock>
        );
      })}
    </ContentFrame>
  );
}

function BlockContent({
  block,
  onPressImage,
  onLongPress,
}: {
  block: cn.Block;
  onPressImage?: (src: string) => void;
  onLongPress?: () => void;
}) {
  switch (block.type) {
    case 'blockquote':
      return <Blockquote block={block} />;
    case 'paragraph':
      return (
        <LineRenderer
          inlines={block.content}
          onPressImage={onPressImage}
          onLongPress={onLongPress}
        />
      );
    case 'image':
      return (
        <ImageBlock
          block={block}
          onPress={onPressImage}
          onLongPress={onLongPress}
        />
      );
    case 'video':
      return <VideoEmbed video={block} />;
    case 'reference':
      return (
        <ContentReferenceLoader viewMode={'attachment'} reference={block} />
      );
    case 'code':
      return <CodeBlock code={block.content} lang={block.lang} />;
    case 'header':
      return <Header block={block} />;
    case 'rule':
      return <Rule />;
    case 'list':
      return <ListBlock block={block} />;
    case 'bigEmoji':
      return <BigEmojiLine>{block.emoji}</BigEmojiLine>;
  }
}
