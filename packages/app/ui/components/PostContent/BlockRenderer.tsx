import { isValidUrl, makePrettyTimeFromMs } from '@tloncorp/api/lib/utils';
import { useMutableCallback } from '@tloncorp/shared';
import type * as cn from '@tloncorp/shared/logic';
import {
  ForwardingProps,
  GestureTrigger,
  Icon,
  Image,
  Pressable,
  Text,
  useCopy,
} from '@tloncorp/ui';
import { ImageLoadEventData } from 'expo-image';
import { clamp, throttle } from 'lodash';
import React, {
  ComponentProps,
  ComponentType,
  PropsWithChildren,
  createContext,
  memo,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  View as RNView,
} from 'react-native';
import {
  ScrollView as GHScrollView,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { ScrollView, View, ViewStyle, XStack, YStack, styled } from 'tamagui';

import { useNowPlayingController } from '../../contexts/nowPlaying';
import { Waveform } from '../AudioRecorder/Waveform';
import { Reference } from '../ContentReference/Reference';
import {
  ContentReferenceLoaderComponent,
  ContentReferenceLoaderProps,
} from '../ContentReference/types';
import { VideoEmbed } from '../Embed';
import { FileUploadPreview } from '../FileUploadPreview';
import { HighlightedCode } from '../HighlightedCode';
import { A2UIBlock } from './A2UIBlock';
import { BlockquoteSideBorder } from './BlockquoteSideBorder';
import { InlineRenderer } from './InlineRenderer';
import { ContentContext, useContentContext } from './contentUtils';

export const IsInsideReferenceContext = createContext(false);
// Provides the ContentReferenceLoader component to BlockRenderer without
// creating a circular import. Set once at the app root via ContentReferenceLoaderProvider.
// (This is a genuine circular dependency since a reference can render content that renders a reference.)
export const ContentReferenceContext =
  createContext<ContentReferenceLoaderComponent | null>(null);

const DUMMY_WAVEFORM_VALUES = [
  1, 0.5, 1, 0.2, 0.8, 0.4, 0.6, 0.3, 0.7, 0.1, 0.9, 0.5, 1, 0.4, 0.6,
];

const WAVEFORM_CANDLE_WIDTH = 3;
const WAVEFORM_CANDLE_SPACING = 1;

export const BlockWrapper = styled(View, {
  name: 'ContentBlock',
  context: ContentContext,
  padding: '$l',
  cursor: 'default',
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
      // We return null here because the tasklist marker is rendered in the
      // InlineTask component in the InlineRenderer
      return null;
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
  color?: string;
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
  const context = useContentContext();
  const TextComponent =
    useContext(BlockRendererContext)?.renderers?.lineText ?? LineText;
  const defaultProps =
    useContext(BlockRendererContext)?.settings?.lineText ?? {};

  return (
    <TextComponent {...defaultProps} {...props} isNotice={context.isNotice} />
  );
}

export const LineText = styled(Text, {
  color: '$primaryText',
  size: '$body',
  context: ContentContext,
  userSelect: 'text',
  cursor: 'text',
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
}: {
  block: cn.ReferenceBlockData;
} & Omit<ContentReferenceLoaderProps, 'reference'>) {
  const isInsideReference = useContext(IsInsideReferenceContext);
  const ReferenceLoader = useContext(ContentReferenceContext);

  if (isInsideReference) {
    return null;
  }

  if (!ReferenceLoader) {
    console.warn(
      'ReferenceBlock rendered without a ReferenceLoader in context'
    );
    return null;
  }

  return <ReferenceLoader reference={block} {...props} />;
}

export function VoiceMemoBlock({
  block,
  ...props
}: { block: cn.VoiceMemoBlockData } & ComponentProps<typeof Reference.Frame>) {
  const {
    togglePlayback,
    seekTo,
    beginScrub,
    endScrub,
    progress,
    status,
    isThisSourceLoaded,
  } = useNowPlayingController({ sourceUri: block.voiceMemo.fileUri });

  const waveformWidthRef = useRef(0);
  const seekToWaveformX = useMutableCallback((x: number) => {
    const width = waveformWidthRef.current;
    // the loaded duration can be 0 before expo-audio has determined it; fall
    // back to the memo's metadata duration
    const loadedDuration =
      progress?.loadState === 'loaded' && isThisSourceLoaded
        ? progress.duration
        : 0;
    const duration =
      loadedDuration > 0 ? loadedDuration : block.voiceMemo.duration ?? 0;
    if (duration === 0 || width <= 0) {
      return;
    }
    // The waveform draws whole candles only, so its drawn strip can be
    // narrower than the container; map the gesture over the strip so
    // positions line up with the candles. The last candle ends one spacing
    // short of the candle slots, so drop the trailing spacing.
    const candleSize = WAVEFORM_CANDLE_WIDTH + WAVEFORM_CANDLE_SPACING;
    const candleCount = Math.floor(width / candleSize);
    const drawnExtent = candleCount * candleSize - WAVEFORM_CANDLE_SPACING;
    if (drawnExtent <= 0) {
      return;
    }
    seekTo(clamp(x / drawnExtent, 0, 1) * duration);
  });

  // throttled so scrubbing doesn't spam the native player with seeks
  const throttledSeekToWaveformX = useMemo(
    () => throttle(seekToWaveformX, 100),
    [seekToWaveformX]
  );

  const seekGesture = useMemo(() => {
    const hitSlop = { top: 12, bottom: 12 };
    const tap = Gesture.Tap()
      .runOnJS(true)
      .hitSlop(hitSlop)
      .onEnd((e) => seekToWaveformX(e.x));
    const pan = Gesture.Pan()
      .runOnJS(true)
      .hitSlop(hitSlop)
      // activate on horizontal drags only, leaving vertical scrolling to the
      // channel list
      .activeOffsetX([-10, 10])
      .failOffsetY([-10, 10])
      // pause a playing memo while scrubbing, resume on release
      .onStart(() => beginScrub())
      .onUpdate((e) => throttledSeekToWaveformX(e.x))
      .onEnd((e) => {
        throttledSeekToWaveformX.cancel();
        seekToWaveformX(e.x);
      })
      .onFinalize(() => endScrub());
    return Gesture.Race(pan, tap);
  }, [seekToWaveformX, throttledSeekToWaveformX, beginScrub, endScrub]);

  const candlePlaybackPosition = useMemo(() => {
    const candleCount = block.voiceMemo.waveformPreview
      ? block.voiceMemo.waveformPreview.length
      : DUMMY_WAVEFORM_VALUES.length;
    if (
      progress?.loadState !== 'loaded' ||
      !isThisSourceLoaded ||
      progress.duration === 0
    ) {
      return 0;
    }
    return clamp(
      Math.floor((progress.currentTime / progress.duration) * candleCount),
      0,
      candleCount - 1
    );
  }, [progress, block.voiceMemo.waveformPreview, isThisSourceLoaded]);

  return (
    <Reference.Frame {...props}>
      <Reference.Header alignItems="center">
        <Reference.Title>
          <Reference.TitleText>Voice Memo</Reference.TitleText>
        </Reference.Title>

        <Reference.TitleIcon type="Wave" color="$primaryText" />
      </Reference.Header>

      <Reference.Body
        flexDirection="column"
        alignItems="stretch"
        gap="$l"
        padding="$l"
        // Reference.Body definition sets `pointerEvents: none`
        pointerEvents="auto"
      >
        <XStack gap="$xl" alignItems="center">
          <Pressable
            backgroundColor="$background"
            width="$4xl"
            aspectRatio={1}
            alignItems="center"
            justifyContent="center"
            borderRadius={8}
            cursor="pointer"
            hoverStyle={{ backgroundColor: '$positiveBackground' }}
            pressStyle={{ opacity: 0.5 }}
            onPress={togglePlayback}
          >
            {(() => {
              switch (status) {
                case null:
                  return <Icon type={'Play'} color="$primaryText" />;
                case 'loading':
                  return <ActivityIndicator />;
                case 'playing':
                  return <Icon type={'Stop'} color="$primaryText" />;
                case 'paused':
                  return <Icon type={'Play'} color="$primaryText" />;
              }
            })()}
          </Pressable>
          <XStack flex={1} gap={9} alignItems="center">
            <GestureDetector gesture={seekGesture}>
              <View
                flex={1}
                // expands UIKit hit testing so slop touches reach the
                // gesture handler on iOS; the gestures' own hitSlop covers
                // RNGH's bounds check (and Android)
                hitSlop={{ top: 12, bottom: 12 }}
                onLayout={(e) => {
                  waveformWidthRef.current = e.nativeEvent.layout.width;
                }}
              >
                <Waveform
                  candleWidth={WAVEFORM_CANDLE_WIDTH}
                  candleSpacing={WAVEFORM_CANDLE_SPACING}
                  candlePlaybackPosition={candlePlaybackPosition}
                  values={
                    block.voiceMemo.waveformPreview ?? DUMMY_WAVEFORM_VALUES
                  }
                  // the Skia canvas would otherwise capture touches meant for
                  // the seek gesture
                  style={{ height: 22, pointerEvents: 'none' }}
                />
              </View>
            </GestureDetector>
            {block.voiceMemo.duration != null && (
              <Text size="$label/s" color="$secondaryText">
                {progress?.loadState === 'loaded'
                  ? makePrettyTimeFromMs(progress.currentTime * 1000)
                  : makePrettyTimeFromMs(block.voiceMemo.duration * 1000)}
              </Text>
            )}
          </XStack>
        </XStack>

        {block.voiceMemo.transcription && (
          <VoiceMemoTranscription
            transcription={block.voiceMemo.transcription}
          />
        )}
      </Reference.Body>
    </Reference.Frame>
  );
}

function VoiceMemoTranscription({ transcription }: { transcription: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <XStack gap="$s" alignItems="baseline">
      <Text
        flex={1}
        size="$label/m"
        numberOfLines={expanded ? undefined : 1}
        ellipsizeMode="tail"
        selectable
      >
        {transcription}
      </Text>
      {!expanded && (
        <Pressable onPress={() => setExpanded(true)}>
          <Text size="$label/m" color="$tertiaryText">
            See more
          </Text>
        </Pressable>
      )}
    </XStack>
  );
}

export function FileUploadBlock({
  block,
  ...passedProps
}: ForwardingProps<
  typeof FileUploadPreview,
  { block: cn.FileUploadBlockData },
  'file'
>) {
  return <FileUploadPreview file={block.file} {...passedProps} />;
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

export function LinkBlock({
  block,
  imageProps,
  renderDescription = true,
  renderTitle = true,
  renderImage = true,
  clickable = true,
  ...props
}: {
  block: cn.LinkBlockData;
  clickable?: boolean;
  renderDescription?: boolean;
  renderTitle?: boolean;
  renderImage?: boolean;
  imageProps?: ComponentProps<typeof ContentImage>;
} & ComponentProps<typeof Reference.Frame>) {
  const urlIsValid = useMemo(() => isValidUrl(block.url), [block.url]);

  const domain = useMemo(() => {
    if (!urlIsValid) {
      return block.url;
    }

    const url = new URL(block.url);
    return url.hostname;
  }, [block.url, urlIsValid]);

  const onPress = useCallback(() => {
    if (!urlIsValid) {
      return;
    }

    if (Platform.OS === 'web') {
      window.open(block.url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(block.url);
    }
  }, [block.url, urlIsValid]);

  if (!urlIsValid) {
    return (
      <Reference.Frame {...props}>
        <Reference.Header>
          <Reference.Title>
            <Icon type="Link" color="$tertiaryText" customSize={[12, 12]} />
            <Reference.TitleText>Invalid URL</Reference.TitleText>
          </Reference.Title>
        </Reference.Header>
        <Reference.Body>
          <View padding="$xl">
            <Text size="$label/m" color="$secondaryText">
              {block.url}
            </Text>
          </View>
        </Reference.Body>
      </Reference.Frame>
    );
  }

  return (
    <Reference.Frame {...props} onPress={clickable ? onPress : undefined}>
      <Reference.Header>
        <Reference.Title>
          <Icon type="Link" color="$tertiaryText" customSize={[12, 12]} />
          <Reference.TitleText>{domain}</Reference.TitleText>
        </Reference.Title>
      </Reference.Header>
      <Reference.Body>
        {renderImage && block.previewImageUrl && (
          <ContentImage
            fallback={null}
            source={block.previewImageUrl}
            flex={1}
            aspectRatio={2}
            flexShrink={0}
            width="100%"
            contentFit="cover"
            contentPosition="center"
            {...imageProps}
          />
        )}
        <YStack flex={0} padding="$xl" gap="$xl">
          <YStack gap="$s">
            <Text fontWeight="500" color="$secondaryText">
              {block.siteName && block.siteName.length > 0
                ? block.siteName
                : domain}
            </Text>
            {renderTitle && (
              <Text size="$label/m" numberOfLines={1}>
                {block.title && block.title.length > 0
                  ? block.title
                  : block.url}
              </Text>
            )}
          </YStack>
          {block.description && renderDescription && (
            <Text size="$label/s" color="$secondaryText">
              {block.description}
            </Text>
          )}
        </YStack>
      </Reference.Body>
    </Reference.Frame>
  );
}

export function VideoBlock({
  block,
  ...props
}: { block: cn.VideoBlockData } & Omit<
  ComponentProps<typeof VideoEmbed>,
  'video'
>) {
  return <VideoEmbed video={block.video} {...props} />;
}

export function ImageBlock({
  block,
  imageProps,
  ...props
}: {
  block: cn.ImageBlockData;
  imageProps?: ComponentProps<typeof ContentImage>;
} & ComponentProps<typeof View>) {
  const { getImageViewerId, onPressImage, onLongPress } = useContentContext();
  const [dimensions, setDimensions] = useState({
    width: block.width || null,
    height: block.height || null,
    aspect: block.width && block.height ? block.width / block.height : null,
  });

  const isInsideReference = useContext(IsInsideReferenceContext);

  const handlePress = useCallback(() => {
    onPressImage?.(block.src);
  }, [block.src, onPressImage]);

  const handleImageLoaded = useCallback((e: ImageLoadEventData) => {
    const aspect = e.source.width / e.source.height;
    setDimensions({
      width: e.source.width,
      height: e.source.height,
      aspect,
    });
  }, []);

  const shouldUseAspectRatio = imageProps?.aspectRatio !== 'unset';
  const viewerId = getImageViewerId?.(block.src);

  // Calculate constrained dimensions that respect both maxWidth and maxHeight
  // while maintaining the natural aspect ratio (similar to VideoEmbed logic).
  // Dimensions are applied to the Pressable wrapper so ContentImage fills it.
  const constrainedSize = useMemo(() => {
    const aspect = dimensions.aspect;
    if (!aspect) return null;
    const maxW =
      typeof imageProps?.maxWidth === 'number' ? imageProps.maxWidth : null;
    const maxH =
      typeof imageProps?.maxHeight === 'number' ? imageProps.maxHeight : null;
    if (maxW != null && maxH != null) {
      const width = Math.min(maxW, maxH * aspect);
      return { width, height: width / aspect };
    }
    return null;
  }, [dimensions.aspect, imageProps?.maxWidth, imageProps?.maxHeight]);

  // When using constrained sizing, strip maxWidth/maxHeight from imageProps
  // so they don't override responsive sizing on narrow viewports.
  const {
    maxWidth: _imageMaxWidth,
    maxHeight: _imageMaxHeight,
    ...remainingImageProps
  } = imageProps ?? {};

  const imagePressable = (
    <Pressable
      overflow="hidden"
      onPress={handlePress}
      onLongPress={onLongPress}
      {...props}
      {...(constrainedSize
        ? {
            alignSelf: 'flex-start' as const,
            width: constrainedSize.width,
            height: constrainedSize.height,
            maxWidth: '100%',
          }
        : dimensions.width
          ? { maxWidth: dimensions.width }
          : {})}
    >
      <ContentImage
        source={{
          uri: block.src,
        }}
        {...(constrainedSize ? { width: '100%', height: '100%' } : {})}
        {...(shouldUseAspectRatio && !constrainedSize
          ? { aspectRatio: dimensions.aspect || 1 }
          : {})}
        {...(isInsideReference
          ? {
              maxHeight: 250,
              resizeMode: 'contain',
            }
          : {})}
        contentFit="contain"
        borderRadius="$s"
        alt={block.alt}
        onLoad={handleImageLoaded}
        {...(constrainedSize ? remainingImageProps : imageProps)}
      />
    </Pressable>
  );

  if (!viewerId) {
    return imagePressable;
  }

  return <GestureTrigger id={viewerId}>{imagePressable}</GestureTrigger>;
}

const ContentImage = styled(Image, {
  name: 'ContentImage',
  width: '100%',
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
      <LineRenderer inlines={block.content} color={'$tertiaryText'} />
    </YStack>
  );
}

export function HeaderBlock({
  block,
  ...props
}: { block: cn.HeaderBlockData } & ComponentProps<typeof HeaderText>) {
  return (
    <HeaderText render={block.level} level={block.level} {...props}>
      {block.children.map((con, i) => (
        <InlineRenderer key={`${con}-${i}`} inline={con} />
      ))}
    </HeaderText>
  );
}

export const HeaderText = styled(Text, {
  variants: {
    level: {
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
HeaderText.displayName = 'HeaderText';

function alignToTextAlign(
  align: cn.TableAlignment | null | undefined
): 'left' | 'center' | 'right' | 'auto' {
  if (align === 'left' || align === 'center' || align === 'right') return align;
  return 'auto';
}

const TABLE_MAX_COLUMN_WIDTH = 280;

export function TableBlock({ block }: { block: cn.TableBlockData }) {
  const columnCount = Math.max(
    block.header.cells.length,
    ...block.rows.map((r) => r.cells.length)
  );
  const allRows = [block.header, ...block.rows];

  const cellRefs = useRef<Map<string, RNView>>(new Map());
  const [columnWidths, setColumnWidths] = useState<number[] | null>(null);

  // Reset measurement when the table's actual content changes. We can't key
  // on `block` reference — upstream memoization invalidates often enough
  // (every time the `post` object gets a new ref from the data layer) that
  // a [block]-dep reset clears measurement mid-flight and the table never
  // converges to aligned columns. Fingerprint the cell content itself so
  // edits that change rendered width (e.g. "iii" → "WWW", swapped emoji,
  // re-styled inlines) invalidate the cache while pure reference churn
  // over equivalent content is a no-op.
  const contentKey = useMemo(
    () =>
      JSON.stringify([
        block.header.cells.map((c) => c.content),
        block.rows.map((r) => r.cells.map((c) => c.content)),
        block.align,
      ]),
    [block]
  );
  const lastContentKeyRef = useRef(contentKey);
  if (lastContentKeyRef.current !== contentKey) {
    lastContentKeyRef.current = contentKey;
    if (columnWidths !== null) {
      setColumnWidths(null);
    }
  }

  // Measure each cell imperatively after first paint. `View.measure` reports
  // post-layout dimensions deterministically, even when an `onLayout`-driven
  // pipeline would race against upstream re-renders and miss events.
  useLayoutEffect(() => {
    if (columnWidths !== null) return;
    const widths: number[] = new Array(columnCount).fill(0);
    let pending = 0;
    let resolved = 0;
    let cancelled = false;
    for (let row = 0; row < allRows.length; row++) {
      for (let col = 0; col < columnCount; col++) {
        const ref = cellRefs.current.get(`${row}-${col}`);
        if (!ref) continue;
        pending++;
        ref.measure((_x, _y, w) => {
          if (cancelled) return;
          if (w > widths[col]) widths[col] = w;
          resolved++;
          if (resolved === pending) {
            setColumnWidths(
              widths.map((cw) => Math.min(cw, TABLE_MAX_COLUMN_WIDTH))
            );
          }
        });
      }
    }
    return () => {
      cancelled = true;
    };
  }, [columnWidths, columnCount, allRows.length, contentKey]);

  const setCellRef = useCallback(
    (rowIdx: number, colIdx: number) => (node: RNView | null) => {
      const key = `${rowIdx}-${colIdx}`;
      if (node) {
        cellRefs.current.set(key, node);
      } else {
        cellRefs.current.delete(key);
      }
    },
    []
  );

  const totalWidth = columnWidths?.reduce((a, b) => a + b, 0);

  // Use react-native-gesture-handler's ScrollView so horizontal pans aren't
  // swallowed by the vertical FlatList that wraps each chat message —
  // RN's stock ScrollView shares the JS responder system with the parent and
  // loses the gesture race; the GH version uses native gesture recognizers.
  return (
    <GHScrollView
      horizontal
      style={{ width: '100%', maxWidth: '100%' }}
      showsHorizontalScrollIndicator={false}
    >
      <YStack {...(totalWidth != null ? { width: totalWidth } : {})}>
        {allRows.map((row, rowIdx) => {
          const isHeader = rowIdx === 0;
          return (
            <XStack
              key={rowIdx}
              flexShrink={0}
              borderBottomWidth={rowIdx < allRows.length - 1 ? 1 : 0}
              borderColor="$border"
            >
              {Array.from({ length: columnCount }).map((_, colIdx) => {
                const cell = row.cells[colIdx] ?? { content: [] };
                const align = block.align[colIdx] ?? null;
                const textAlign = alignToTextAlign(align);
                const colWidth = columnWidths?.[colIdx];
                return (
                  <View
                    key={colIdx}
                    ref={setCellRef(rowIdx, colIdx)}
                    flexShrink={0}
                    paddingVertical="$xl"
                    paddingLeft={colIdx === 0 ? 0 : '$l'}
                    paddingRight="$l"
                    {...(colWidth != null
                      ? { width: colWidth }
                      : { maxWidth: TABLE_MAX_COLUMN_WIDTH })}
                  >
                    <LineRenderer
                      inlines={cell.content}
                      size="$label/m"
                      textAlign={textAlign}
                      {...(isHeader ? { color: '$tertiaryText' } : {})}
                    />
                  </View>
                );
              })}
            </XStack>
          );
        })}
      </YStack>
    </GHScrollView>
  );
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
  a2ui: () => null,
  link: LinkBlock,
  image: ImageBlock,
  video: VideoBlock,
  reference: ReferenceBlock,
  code: CodeBlock,
  header: HeaderBlock,
  rule: RuleBlock,
  list: ListBlock,
  bigEmoji: BigEmojiBlock,
  file: FileUploadBlock,
  voicememo: VoiceMemoBlock,
  table: TableBlock,
};

type BlockSettings<T extends ComponentType> = Partial<ComponentProps<T>> & {
  wrapperProps?: Partial<ComponentProps<typeof BlockWrapper>>;
};

export type DefaultRendererProps = {
  blockWrapper: Partial<ComponentProps<typeof BlockWrapper>>;
  lineText: Partial<ComponentProps<typeof LineText>>;
  blockquote: BlockSettings<typeof BlockquoteBlock>;
  paragraph: BlockSettings<typeof ParagraphBlock>;
  a2ui: BlockSettings<typeof A2UIBlock>;
  link: BlockSettings<typeof LinkBlock>;
  image: BlockSettings<typeof ImageBlock>;
  video: BlockSettings<typeof VideoBlock>;
  reference: BlockSettings<typeof ReferenceBlock>;
  code: BlockSettings<typeof CodeBlock>;
  header: BlockSettings<typeof HeaderBlock>;
  rule: BlockSettings<typeof RuleBlock>;
  list: BlockSettings<typeof ListBlock>;
  bigEmoji: BlockSettings<typeof BigEmojiBlock>;
  file: BlockSettings<typeof FileUploadBlock>;
  voicememo: BlockSettings<typeof VoiceMemoBlock>;
  table: BlockSettings<typeof TableBlock>;
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
