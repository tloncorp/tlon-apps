import { isValidUrl, makePrettyTimeFromMs } from '@tloncorp/api/lib/utils';
import type * as cn from '@tloncorp/shared/logic';
import {
  ForwardingProps,
  Icon,
  Image,
  Pressable,
  Text,
  useCopy,
} from '@tloncorp/ui';
import { ImageLoadEventData } from 'expo-image';
import { clamp } from 'lodash';
import React, {
  ComponentProps,
  ComponentType,
  PropsWithChildren,
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { ActivityIndicator, Linking, Platform } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { ScrollView, View, ViewStyle, XStack, YStack, styled } from 'tamagui';

import { useNowPlayingController } from '../../contexts/nowPlaying';
import { Waveform } from '../AudioRecorder/Waveform';
import {
  ContentReferenceLoader,
  IsInsideReferenceContext,
  Reference,
} from '../ContentReference';
import { VideoEmbed } from '../Embed';
import { FileUploadPreview } from '../FileUploadPreview';
import { HighlightedCode } from '../HighlightedCode';
import { BlockquoteSideBorder } from './BlockquoteSideBorder';
import { InlineRenderer } from './InlineRenderer';
import { ContentContext, useContentContext } from './contentUtils';

const DUMMY_WAVEFORM_VALUES = [
  1, 0.5, 1, 0.2, 0.8, 0.4, 0.6, 0.3, 0.7, 0.1, 0.9, 0.5, 1, 0.4, 0.6,
];

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
}: { block: cn.ReferenceBlockData } & Omit<
  ComponentProps<typeof ContentReferenceLoader>,
  'reference'
>) {
  const isInsideReference = useContext(IsInsideReferenceContext);

  if (isInsideReference) {
    return null;
  }

  return <ContentReferenceLoader reference={block} {...props} />;
}

export function VoiceMemoBlock({
  block,
  ...props
}: { block: cn.VoiceMemoBlockData } & ComponentProps<
  typeof Reference.Frame
>) {
  const { togglePlayback, progress, status, isThisSourceLoaded } =
    useNowPlayingController({ sourceUri: block.voiceMemo.fileUri });

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
            <Waveform
              candleWidth={3}
              candleSpacing={1}
              candlePlaybackPosition={candlePlaybackPosition}
              values={block.voiceMemo.waveformPreview ?? DUMMY_WAVEFORM_VALUES}
              style={{ flex: 1, height: 22 }}
            />
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

// Ochre-aligned chart palette
const CHART_COLORS = [
  '#3B80E8',
  '#E8913B',
  '#7B61FF',
  '#36B37E',
  '#E22A2A',
  '#00B8D9',
];

const CHART_SVG_WIDTH = 300;
const GRID_COLOR = '#E5E5E5';
const CHART_PADDING = { top: 8, right: 8, bottom: 4, left: 8 };

function chartIcon(type: string): string {
  if (type === 'pie') return '\uD83E\uDD67';
  if (type === 'sparkline') return '\u26A1';
  return '\uD83D\uDCCA';
}

function getSeriesColor(series: cn.ChartBlockData['series'][number], i: number) {
  return series.color ?? CHART_COLORS[i % CHART_COLORS.length];
}

function GridLines({ width, height }: { width: number; height: number }) {
  const lines = [0.25, 0.5, 0.75, 1.0];
  return (
    <>
      {lines.map((frac) => {
        const y = CHART_PADDING.top + (1 - frac) * height;
        return (
          <Line
            key={frac}
            x1={CHART_PADDING.left}
            y1={y}
            x2={width - CHART_PADDING.right}
            y2={y}
            stroke={GRID_COLOR}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        );
      })}
    </>
  );
}

function BarChartSvg({ block }: { block: cn.ChartBlockData }) {
  const chartHeight = Math.min(block.height ?? 200, 300);
  const svgHeight = chartHeight + CHART_PADDING.top + CHART_PADDING.bottom;
  const drawW = CHART_SVG_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const drawH = chartHeight;

  const allValues = block.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 0);
  const minFloor = Math.min(...allValues, 0);
  const range = maxVal - minFloor || 1;

  const groupCount = Math.max(...block.series.map((s) => s.values.length), 1);
  const seriesCount = block.series.length;
  const groupWidth = drawW / groupCount;
  const groupGap = Math.max(groupWidth * 0.2, 2);
  const barsWidth = groupWidth - groupGap;
  const barWidth = barsWidth / seriesCount;

  return (
    <Svg width="100%" height={svgHeight} viewBox={`0 0 ${CHART_SVG_WIDTH} ${svgHeight}`}>
      <GridLines width={CHART_SVG_WIDTH} height={drawH} />
      {Array.from({ length: groupCount }).map((_, gi) =>
        block.series.map((s, si) => {
          const val = s.values[gi] ?? 0;
          const pct = (val - Math.min(minFloor, 0)) / range;
          const barH = Math.max(pct * drawH, 1);
          const x = CHART_PADDING.left + gi * groupWidth + groupGap / 2 + si * barWidth;
          const y = CHART_PADDING.top + drawH - barH;
          const color = getSeriesColor(s, si);
          const rx = 3;
          return (
            <React.Fragment key={`${gi}-${si}`}>
              <Rect x={x} y={y} width={barWidth - 1} height={barH} rx={rx} ry={rx} fill={color} />
              {barH > rx && (
                <Rect
                  x={x}
                  y={y + barH - rx}
                  width={barWidth - 1}
                  height={rx}
                  fill={color}
                />
              )}
            </React.Fragment>
          );
        })
      )}
    </Svg>
  );
}

function LineChartSvg({ block }: { block: cn.ChartBlockData }) {
  const chartHeight = Math.min(block.height ?? 200, 300);
  const svgHeight = chartHeight + CHART_PADDING.top + CHART_PADDING.bottom;
  const drawW = CHART_SVG_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const drawH = chartHeight;

  const allValues = block.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 0);
  const minFloor = Math.min(...allValues, 0);
  const range = maxVal - minFloor || 1;

  const maxLen = Math.max(...block.series.map((s) => s.values.length), 1);

  function toPoint(vi: number, val: number): [number, number] {
    const x = CHART_PADDING.left + (maxLen > 1 ? (vi / (maxLen - 1)) * drawW : drawW / 2);
    const y = CHART_PADDING.top + (1 - (val - Math.min(minFloor, 0)) / range) * drawH;
    return [x, y];
  }

  return (
    <Svg width="100%" height={svgHeight} viewBox={`0 0 ${CHART_SVG_WIDTH} ${svgHeight}`}>
      <GridLines width={CHART_SVG_WIDTH} height={drawH} />
      {block.series.map((s, si) => {
        const points = s.values.map((v, vi) => toPoint(vi, v));
        const pointsStr = points.map((p) => p.join(',')).join(' ');
        const color = getSeriesColor(s, si);
        return (
          <React.Fragment key={si}>
            <Polyline points={pointsStr} stroke={color} strokeWidth={2} fill="none" />
            {points.map(([cx, cy], pi) => (
              <Circle key={pi} cx={cx} cy={cy} r={3} fill={color} />
            ))}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function AreaChartSvg({ block }: { block: cn.ChartBlockData }) {
  const chartHeight = Math.min(block.height ?? 200, 300);
  const svgHeight = chartHeight + CHART_PADDING.top + CHART_PADDING.bottom;
  const drawW = CHART_SVG_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const drawH = chartHeight;

  const allValues = block.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 0);
  const minFloor = Math.min(...allValues, 0);
  const range = maxVal - minFloor || 1;

  const maxLen = Math.max(...block.series.map((s) => s.values.length), 1);
  const baseY = CHART_PADDING.top + drawH;

  function toPoint(vi: number, val: number): [number, number] {
    const x = CHART_PADDING.left + (maxLen > 1 ? (vi / (maxLen - 1)) * drawW : drawW / 2);
    const y = CHART_PADDING.top + (1 - (val - Math.min(minFloor, 0)) / range) * drawH;
    return [x, y];
  }

  return (
    <Svg width="100%" height={svgHeight} viewBox={`0 0 ${CHART_SVG_WIDTH} ${svgHeight}`}>
      <GridLines width={CHART_SVG_WIDTH} height={drawH} />
      {block.series.map((s, si) => {
        const points = s.values.map((v, vi) => toPoint(vi, v));
        const color = getSeriesColor(s, si);
        const firstX = points[0]?.[0] ?? CHART_PADDING.left;
        const lastX = points[points.length - 1]?.[0] ?? CHART_PADDING.left;
        const areaPath =
          `M${firstX},${baseY} ` +
          points.map((p) => `L${p[0]},${p[1]}`).join(' ') +
          ` L${lastX},${baseY} Z`;
        const lineStr = points.map((p) => p.join(',')).join(' ');
        return (
          <React.Fragment key={si}>
            <Path d={areaPath} fill={color} opacity={0.3} />
            <Polyline points={lineStr} stroke={color} strokeWidth={2} fill="none" />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function SparklineSvg({ block }: { block: cn.ChartBlockData }) {
  const s = block.series[0];
  if (!s || s.values.length === 0) return null;

  const svgH = 40;
  const drawW = CHART_SVG_WIDTH;
  const padding = 4;
  const drawH = svgH - padding * 2;

  const maxVal = Math.max(...s.values);
  const minVal = Math.min(...s.values);
  const range = maxVal - minVal || 1;

  const points = s.values
    .map((v, i) => {
      const x = s.values.length > 1 ? (i / (s.values.length - 1)) * drawW : drawW / 2;
      const y = padding + (1 - (v - minVal) / range) * drawH;
      return `${x},${y}`;
    })
    .join(' ');

  const delta = s.values[s.values.length - 1]! - s.values[0]!;
  const color = getSeriesColor(s, 0);

  return (
    <XStack alignItems="center" gap="$m">
      <View flex={1}>
        <Svg width="100%" height={svgH} viewBox={`0 0 ${CHART_SVG_WIDTH} ${svgH}`}>
          <Polyline points={points} stroke={color} strokeWidth={2} fill="none" />
        </Svg>
      </View>
      <Text
        size="$label/s"
        color={delta >= 0 ? '#36B37E' : '#E22A2A'}
        fontWeight="500"
      >
        {delta >= 0 ? '+' : ''}
        {delta.toFixed(1)}
      </Text>
    </XStack>
  );
}

function PieChart({ block }: { block: cn.ChartBlockData }) {
  const values = block.series[0]?.values ?? [];
  const total = values.reduce((a, b) => a + Math.max(b, 0), 0) || 1;

  return (
    <YStack gap="$s" paddingVertical="$m">
      {values.map((val, i) => {
        const pct = (Math.max(val, 0) / total) * 100;
        const label = block.xLabels?.[i] ?? block.series[0]?.label ?? `${i}`;
        const color = CHART_COLORS[i % CHART_COLORS.length];
        return (
          <XStack key={i} alignItems="center" gap="$m">
            <View
              width={10}
              height={10}
              borderRadius={5}
              backgroundColor={color}
            />
            <Text size="$label/s" color="$secondaryText" flex={1}>
              {label}
            </Text>
            <View flex={1} height={4} borderRadius={2} backgroundColor={GRID_COLOR} marginHorizontal="$m">
              <View
                height={4}
                borderRadius={2}
                backgroundColor={color}
                width={`${pct}%`}
              />
            </View>
            <Text size="$label/s" color="$primaryText" width={45} textAlign="right">
              {pct.toFixed(1)}%
            </Text>
          </XStack>
        );
      })}
    </YStack>
  );
}

export function ChartBlock({
  block,
  ...props
}: { block: cn.ChartBlockData } & ComponentProps<typeof Reference.Frame>) {
  const chartHeight = Math.min(block.height ?? 200, 300);

  const seriesColors = block.series.map((s, i) => getSeriesColor(s, i));

  // Sparkline: minimal inline rendering, no header
  if (block.chartType === 'sparkline') {
    return (
      <Reference.Frame padding="$l" {...props}>
        <SparklineSvg block={block} />
      </Reference.Frame>
    );
  }

  const renderChart = () => {
    switch (block.chartType) {
      case 'bar':
        return <BarChartSvg block={block} />;
      case 'line':
        return <LineChartSvg block={block} />;
      case 'area':
        return <AreaChartSvg block={block} />;
      case 'pie':
        return <PieChart block={block} />;
      default:
        return null;
    }
  };

  return (
    <Reference.Frame padding="$l" {...props}>
      <Reference.Header>
        <Reference.Title>
          <Text>{chartIcon(block.chartType)} </Text>
          <Reference.TitleText>
            {block.title ??
              `${block.chartType.charAt(0).toUpperCase()}${block.chartType.slice(1)} Chart`}
          </Reference.TitleText>
        </Reference.Title>
        {block.yLabel ? (
          <Text size="$label/s" color="$tertiaryText">
            {block.yLabel}
          </Text>
        ) : null}
      </Reference.Header>

      {renderChart()}

      {block.xLabels && block.chartType !== 'pie' && (
        <XStack>
          {block.xLabels.map((label, i) => (
            <Text
              key={i}
              flex={1}
              size="$label/s"
              color="$tertiaryText"
              textAlign="center"
              numberOfLines={1}
            >
              {label}
            </Text>
          ))}
        </XStack>
      )}

      {block.series.length > 1 && (
        <XStack gap="$m" flexWrap="wrap" paddingTop="$s">
          {block.series.map((s, i) => (
            <XStack key={i} alignItems="center" gap="$s">
              <View
                width={8}
                height={8}
                borderRadius={4}
                backgroundColor={seriesColors[i]}
              />
              <Text size="$label/s" color="$secondaryText">
                {s.label}
              </Text>
            </XStack>
          ))}
        </XStack>
      )}
    </Reference.Frame>
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
  const { onPressImage, onLongPress } = useContentContext();
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

  return (
    <Pressable
      overflow="hidden"
      onPress={handlePress}
      onLongPress={onLongPress}
      {...props}
    >
      <ContentImage
        source={{
          uri: block.src,
        }}
        {...(shouldUseAspectRatio
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
        {...imageProps}
      />
    </Pressable>
  );
}

const ContentImage = styled(Image, {
  name: 'ContentImage',
  context: ContentContext,
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
      <LineRenderer inlines={block.content} color={'$tertiaryText'} />
    </YStack>
  );
}

export function HeaderBlock({
  block,
  ...props
}: { block: cn.HeaderBlockData } & ComponentProps<typeof HeaderText>) {
  return (
    <HeaderText tag={block.level} level={block.level} {...props}>
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
  chart: ChartBlock,
};

type BlockSettings<T extends ComponentType> = Partial<ComponentProps<T>> & {
  wrapperProps?: Partial<ComponentProps<typeof BlockWrapper>>;
};

export type DefaultRendererProps = {
  blockWrapper: Partial<ComponentProps<typeof BlockWrapper>>;
  lineText: Partial<ComponentProps<typeof LineText>>;
  blockquote: BlockSettings<typeof BlockquoteBlock>;
  paragraph: BlockSettings<typeof ParagraphBlock>;
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
  chart: BlockSettings<typeof ChartBlock>;
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
