import { ImageLoadEventData } from 'expo-image';
import React, {
  ComponentProps,
  ComponentType,
  PropsWithChildren,
  createContext,
  memo,
  useCallback,
  useContext,
  useState,
} from 'react';
import {
  ColorTokens,
  ScrollView,
  View,
  ViewStyle,
  XStack,
  YStack,
  styled,
} from 'tamagui';

import { useCopy } from '../../hooks/useCopy';
import { ContentReferenceLoader, Reference } from '../ContentReference';
import { VideoEmbed } from '../Embed';
import { HighlightedCode } from '../HighlightedCode';
import { Image } from '../Image';
import { Text } from '../TextV2';
import { InlineRenderer } from './InlineRenderer';
import * as cn from './contentUtils';

export const BlockWrapper = styled(View, {
  name: 'ContentBlock',
  context: cn.ContentContext,
  padding: '$l',
  variants: {
    isNotice: {
      true: {
        paddingLeft: '$4xl',
        paddingRight: '$4xl',
        width: '100%',
        alignItems: 'center',
      },
    },
    type: {} as Record<cn.BlockData['type'], ViewStyle>,
  } as const,
});

export function ListBlock({
  block,
  ...props
}: { block: cn.ListBlockData } & Omit<
  ComponentProps<typeof ListNode>,
  'node'
>) {
  return <ListNode node={block.list} {...props} />;
}

function ListNode({
  node,
}: {
  node: cn.ListData;
} & ComponentProps<typeof View>) {
  return (
    <View flex={1}>
      {node.content.length ? (
        <LineRenderer trimmed={false} inlines={node.content} />
      ) : null}
      {node.children?.map((childNode, i) => (
        <XStack key={i} gap="$m">
          <ListItemMarker index={i} type={node.type ?? 'unordered'} />
          <ListNode key={i} node={childNode} />
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
      return <TextContent trimmed={false}>{index + 1}.</TextContent>;
    case 'unordered':
      return <TextContent trimmed={false}>•︎</TextContent>;
    case 'tasklist':
      return <TextContent trimmed={false}>{'\u2610'}</TextContent>;
  }
}

/**
 * Renders a list of inlines as a single line of text (can be broken up by line breaks)
 */
export const LineRenderer = memo(function LineRendererComponent({
  inlines,
  ...props
}: {
  inlines: cn.InlineData[];
  color?: ColorTokens;
  trimmed?: boolean;
} & ComponentProps<typeof TextContent>) {
  return (
    // Spread color prop as undefined value will override when we don't want it to
    <TextContent {...props}>
      {inlines.map((child, i) => {
        return <InlineRenderer key={i} inline={child} />;
      })}
    </TextContent>
  );
});

function TextContent(props: ComponentProps<typeof LineText>) {
  const TextComponent =
    useContext(BlockRendererContext)?.renderers?.lineText ?? LineText;
  const defaultProps =
    useContext(BlockRendererContext)?.settings?.lineText ?? {};
  return <TextComponent {...defaultProps} {...props} />;
}

export const LineText = styled(Text, {
  color: '$primaryText',
  size: '$body',
  context: cn.ContentContext,
  variants: {
    isNotice: {
      true: {
        color: '$tertiaryText',
        size: '$label/m',
        textAlign: 'center',
      },
    },
  } as const,
});

export function CodeBlock({
  block,
  textProps,
  ...props
}: { block: cn.CodeBlockData } & ComponentProps<typeof Reference.Frame> & {
    textProps?: ComponentProps<typeof Text>;
  }) {
  const { doCopy, didCopy } = useCopy(block.content);
  const handleStartShouldSetResponder = useCallback(() => true, []);

  return (
    <Reference.Frame {...props}>
      <Reference.Header paddingVertical="$l">
        <Reference.Title>
          <Reference.TitleText>{'Code'}</Reference.TitleText>
        </Reference.Title>
        <Reference.TitleText onPress={doCopy}>
          {didCopy ? 'Copied' : 'Copy'}
        </Reference.TitleText>
      </Reference.Header>
      <ScrollView horizontal>
        <Reference.Body
          pointerEvents="auto"
          // Hack to prevent touch events from being eaten by Pressables higher
          // in the stack.
          onStartShouldSetResponder={handleStartShouldSetResponder}
        >
          <Text size={'$mono/m'} padding="$l" {...textProps}>
            <HighlightedCode code={block.content} lang={block.lang} />
          </Text>
        </Reference.Body>
      </ScrollView>
    </Reference.Frame>
  );
}

export function ParagraphBlock({
  block,
  ...props
}: { block: cn.ParagraphBlockData } & Omit<
  ComponentProps<typeof LineRenderer>,
  'inlines'
>) {
  return <LineRenderer inlines={block.content} {...props} />;
}

export function ReferenceBlock({
  block,
  ...props
}: { block: cn.ReferenceBlockData } & Omit<
  ComponentProps<typeof ContentReferenceLoader>,
  'reference'
>) {
  return <ContentReferenceLoader reference={block} {...props} />;
}

export function BigEmojiBlock({
  block,
  ...props
}: { block: cn.BigEmojiBlockData } & ComponentProps<typeof BigEmojiText>) {
  return <BigEmojiText {...props}>{block.emoji}</BigEmojiText>;
}

const BigEmojiText = styled(Text, {
  size: '$emoji/l',
  flexWrap: 'wrap',
  trimmed: true,
});

export function VideoBlock({
  block,
  ...props
}: { block: cn.VideoBlockData } & Omit<
  ComponentProps<typeof VideoEmbed>,
  'video'
>) {
  return <VideoEmbed video={block} {...props} />;
}

export function ImageBlock({
  block,
  imageProps,
  ...props
}: {
  block: cn.ImageBlockData;
  imageProps?: ComponentProps<typeof ContentImage>;
} & ComponentProps<typeof View>) {
  const { onPressImage, onLongPress } = cn.useContentContext();
  const [aspect, setAspect] = useState<number | null>(
    block.width && block.height ? block.width / block.height : 1
  );

  const handlePress = useCallback(() => {
    onPressImage?.(block.src);
  }, [block.src, onPressImage]);

  const handleImageLoaded = useCallback((e: ImageLoadEventData) => {
    setAspect(e.source.width / e.source.height);
  }, []);

  return (
    <View
      borderRadius="$s"
      overflow="hidden"
      onPress={handlePress}
      onLongPress={onLongPress}
      {...props}
    >
      <ContentImage
        source={{
          uri: block.src,
          width: block.height,
          height: block.width,
        }}
        alt={block.alt}
        onLoad={handleImageLoaded}
        aspectRatio={aspect ?? 1}
        {...imageProps}
      />
    </View>
  );
}

const ContentImage = styled(Image, {
  name: 'ContentImage',
  context: cn.ContentContext,
  width: '100%',
  aspectRatio: 1,
  backgroundColor: '$secondaryBackground',
});

export function RuleBlock({
  block: _block,
  ...props
}: { block: cn.RuleBlockData } & ComponentProps<typeof Rule>) {
  return <Rule {...props} />;
}

const Rule = styled(View, {
  borderBottomWidth: 1,
  borderColor: '$border',
});

export function BlockquoteBlock({
  block,
  ...props
}: { block: cn.BlockquoteBlockData } & ComponentProps<typeof YStack>) {
  return (
    <YStack paddingLeft="$l" {...props}>
      <BlockquoteSideBorder />
      <LineRenderer inlines={block.content} color="$tertiaryText" />
    </YStack>
  );
}

export const BlockquoteSideBorder = styled(View, {
  name: 'BlockquoteSideBorder',
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  borderRadius: 1,
  left: -2,
  backgroundColor: '$border',
});

export function HeaderBlock({
  block,
  ...props
}: { block: cn.HeaderBlockData } & ComponentProps<typeof HeaderText>) {
  return (
    <HeaderText tag={block.level} {...props}>
      {block.children.map((con, i) => (
        <InlineRenderer key={`${con}-${i}`} inline={con} />
      ))}
    </HeaderText>
  );
}

export const HeaderText = styled(Text, {
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

export function EmbedBlock() {
  return null;
}

export type BlockRenderer<T extends cn.BlockData> = (props: {
  block: T;
}) => React.ReactNode;

export type BlockRendererConfig = {
  [K in cn.BlockType]: BlockRenderer<cn.BlockFromType<K>>;
} & {
  blockWrapper: (
    props: PropsWithChildren<{
      block: cn.BlockData;
    }>
  ) => React.ReactNode;
  lineText: (props: ComponentProps<typeof LineText>) => React.ReactNode;
};

export const defaultBlockRenderers: BlockRendererConfig = {
  blockWrapper: BlockWrapper,
  lineText: LineText,
  blockquote: BlockquoteBlock,
  paragraph: ParagraphBlock,
  image: ImageBlock,
  video: VideoBlock,
  reference: ReferenceBlock,
  code: CodeBlock,
  header: HeaderBlock,
  rule: RuleBlock,
  list: ListBlock,
  bigEmoji: BigEmojiBlock,
  embed: EmbedBlock,
};

type BlockSettings<T extends ComponentType> = Partial<ComponentProps<T>> & {
  wrapperProps?: Partial<ComponentProps<typeof BlockWrapper>>;
};

export type DefaultRendererProps = {
  blockWrapper: Partial<ComponentProps<typeof BlockWrapper>>;
  lineText: Partial<ComponentProps<typeof LineText>>;
  blockquote: BlockSettings<typeof BlockquoteBlock>;
  paragraph: BlockSettings<typeof ParagraphBlock>;
  image: BlockSettings<typeof ImageBlock>;
  video: BlockSettings<typeof VideoBlock>;
  reference: BlockSettings<typeof ReferenceBlock>;
  code: BlockSettings<typeof CodeBlock>;
  header: BlockSettings<typeof HeaderBlock>;
  rule: BlockSettings<typeof RuleBlock>;
  list: BlockSettings<typeof ListBlock>;
  bigEmoji: BlockSettings<typeof BigEmojiBlock>;
  embed: BlockSettings<typeof EmbedBlock>;
};

interface BlockRendererContextValue {
  renderers?: Partial<BlockRendererConfig>;
  settings?: Partial<DefaultRendererProps>;
}

const BlockRendererContext = createContext<BlockRendererContextValue>({});

export const BlockRendererProvider = React.memo(function BlockRendererProvider({
  children,
  ...props
}: PropsWithChildren<BlockRendererContextValue>) {
  return (
    <BlockRendererContext.Provider value={props}>
      {children}
    </BlockRendererContext.Provider>
  );
});

export function BlockRenderer({ block }: { block: cn.BlockData }) {
  const { renderers, settings: defaultProps } =
    useContext(BlockRendererContext);
  const Wrapper = renderers?.blockWrapper ?? BlockWrapper;
  const Renderer = (renderers?.[block.type] ??
    defaultBlockRenderers[block.type]) as BlockRenderer<typeof block>;
  const { wrapperProps, ...defaultPropsForBlock } =
    defaultProps?.[block.type] ?? {};
  const defaultPropsForBlockWrapper = defaultProps?.blockWrapper;
  return (
    <Wrapper {...defaultPropsForBlockWrapper} {...wrapperProps} block={block}>
      <Renderer {...defaultPropsForBlock} block={block} />
    </Wrapper>
  );
}
