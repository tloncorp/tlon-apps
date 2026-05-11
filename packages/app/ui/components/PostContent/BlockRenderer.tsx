import { isValidUrl, makePrettyTimeFromMs } from '@tloncorp/api/lib/utils';
import type * as cn from '@tloncorp/shared/logic';
import {
  Button,
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
import { A2UIActionSpec, buildA2UIUserActionEnvelope } from './a2uiActions';
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
}: { block: cn.VoiceMemoBlockData } & ComponentProps<typeof Reference.Frame>) {
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

type A2UIText = { literal?: unknown };
type A2UIComponentEntry = {
  id?: unknown;
  component?: Record<string, Record<string, unknown>>;
};
type TlonButtonIntent = NonNullable<ComponentProps<typeof Button>['intent']>;
type TlonButtonFill = NonNullable<ComponentProps<typeof Button>['fill']>;
type A2UIBadgeTone = 'neutral' | 'positive' | 'warning';
type A2UIGapToken = '$xs' | '$s' | '$m' | '$l' | '$xl';
type A2UIJustify = 'flex-start' | 'center' | 'flex-end' | 'space-between';
type A2UIDataModel = Record<string, unknown>;
type A2UIForecastItem = {
  day: string;
  temp: string;
  summary: string;
};
type A2UIMetricItem = {
  label: string;
  value: string;
  delta?: string;
  icon?: string;
  emoji?: string;
};
type A2UISeriesItem = {
  label: string;
  values: number[];
  labels: string[];
  unit?: string;
};
type A2UIRowItem = {
  label: string;
  value: string;
  detail?: string;
  icon?: string;
  emoji?: string;
};
type A2UIActionDispatch = (
  sourceComponentId: string,
  action: A2UIActionSpec | null | undefined
) => void;

function getA2UIText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (
    value &&
    typeof value === 'object' &&
    'literal' in value &&
    typeof (value as A2UIText).literal === 'string'
  ) {
    return (value as { literal: string }).literal;
  }
  return '';
}

function getA2UIStringProp(
  props: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = getA2UIText(props[key]);
    if (value) {
      return value;
    }
  }
  return '';
}

function getA2UIModelString(
  dataModel: A2UIDataModel | undefined,
  key: string,
  fallback = ''
): string {
  const value = dataModel?.[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return fallback;
}

function getA2UIRecordString(
  record: Record<string, unknown>,
  key: string,
  fallback = ''
): string {
  const value = record[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return fallback;
}

function isA2UIRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getA2UIActionSpec(value: unknown): A2UIActionSpec | null {
  return isA2UIRecord(value) ? value : null;
}

function useA2UIActionDispatcher(
  block: cn.A2UIBlockData,
  onSelectedAction?: (actionName: string) => void
): A2UIActionDispatch {
  const { a2uiSource, onA2UIUserAction } = useContentContext();

  return useCallback(
    (sourceComponentId, action) => {
      const envelope = buildA2UIUserActionEnvelope({
        block,
        sourceComponentId,
        action,
      });

      if (!envelope) {
        return;
      }

      onSelectedAction?.(envelope.userAction.name);

      if (!onA2UIUserAction) {
        console.info('[a2ui] userAction', envelope, a2uiSource);
        return;
      }

      Promise.resolve(onA2UIUserAction(envelope, a2uiSource)).catch((error) => {
        console.error('[a2ui] userAction handler failed', error);
      });
    },
    [a2uiSource, block, onA2UIUserAction, onSelectedAction]
  );
}

function isA2UIShortEmoji(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  return (
    trimmed === value &&
    Array.from(trimmed).length <= 4 &&
    /\p{Extended_Pictographic}/u.test(trimmed) &&
    !/[A-Za-z0-9]/.test(trimmed)
  );
}

function getA2UIIconEmoji(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  switch (value.trim().toLowerCase()) {
    case 'approval':
    case 'check':
      return '✅';
    case 'bot':
      return '✨';
    case 'channel':
      return '#';
    case 'chart':
    case 'dashboard':
    case 'stock':
    case 'trend':
      return '📈';
    case 'cloud':
      return '☁️';
    case 'dm':
      return '💬';
    case 'group':
      return '👥';
    case 'rain':
      return '🌧️';
    case 'receipt':
      return '🧾';
    case 'sun':
    case 'weather':
      return '☀️';
    case 'table':
      return '📊';
    case 'warning':
      return '⚠️';
    default:
      return '';
  }
}

function getA2UIMarker(params: { emoji?: unknown; icon?: unknown }): string {
  if (isA2UIShortEmoji(params.emoji)) {
    return params.emoji;
  }
  return getA2UIIconEmoji(params.icon);
}

function getA2UIBlockMarker(block: cn.A2UIBlockData): string {
  const dataModel = block.a2ui.dataModel;
  return getA2UIMarker({
    emoji: block.a2ui.emoji ?? dataModel?.emoji,
    icon: block.a2ui.icon ?? dataModel?.icon,
  });
}

function getA2UIBlockExplicitEmoji(block: cn.A2UIBlockData): string {
  const dataModel = block.a2ui.dataModel;
  return isA2UIShortEmoji(block.a2ui.emoji)
    ? block.a2ui.emoji
    : isA2UIShortEmoji(dataModel?.emoji)
      ? dataModel.emoji
      : '';
}

function getA2UIForecast(dataModel?: A2UIDataModel): A2UIForecastItem[] {
  const forecast = dataModel?.forecast;
  if (!Array.isArray(forecast)) {
    return [];
  }

  return forecast
    .filter(isA2UIRecord)
    .map((item, index) => ({
      day: getA2UIModelString(item, 'day', `Day ${index + 1}`),
      temp: getA2UIModelString(item, 'temp'),
      summary: getA2UIModelString(item, 'summary'),
    }))
    .filter((item) => item.day || item.temp || item.summary)
    .slice(0, 5);
}

function getA2UIMetrics(dataModel?: A2UIDataModel): A2UIMetricItem[] {
  const metrics = dataModel?.metrics;
  if (!Array.isArray(metrics)) {
    return [];
  }

  return metrics
    .filter(isA2UIRecord)
    .map((item) => ({
      label: getA2UIRecordString(item, 'label'),
      value: getA2UIRecordString(item, 'value'),
      delta: getA2UIRecordString(item, 'delta'),
      icon: getA2UIRecordString(item, 'icon'),
      emoji: getA2UIRecordString(item, 'emoji'),
    }))
    .filter((item) => item.label || item.value)
    .slice(0, 4);
}

function getA2UISeries(dataModel?: A2UIDataModel): A2UISeriesItem[] {
  const series = dataModel?.series;
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .filter(isA2UIRecord)
    .map((item): A2UISeriesItem | null => {
      const values = Array.isArray(item.values)
        ? item.values.filter(
            (value): value is number =>
              typeof value === 'number' && Number.isFinite(value)
          )
        : [];
      if (values.length === 0) {
        return null;
      }

      const labels = Array.isArray(item.labels)
        ? item.labels.map((label) => String(label))
        : values.map((_, index) => String(index + 1));

      return {
        label: getA2UIRecordString(item, 'label', 'Series'),
        values,
        labels,
        unit: getA2UIRecordString(item, 'unit'),
      };
    })
    .filter((item): item is A2UISeriesItem => item !== null)
    .slice(0, 3);
}

function getA2UIRows(dataModel?: A2UIDataModel): A2UIRowItem[] {
  const rows = dataModel?.rows;
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter(isA2UIRecord)
    .map((item) => ({
      label: getA2UIRecordString(item, 'label'),
      value: getA2UIRecordString(item, 'value'),
      detail: getA2UIRecordString(item, 'detail'),
      icon: getA2UIRecordString(item, 'icon'),
      emoji: getA2UIRecordString(item, 'emoji'),
    }))
    .filter((item) => item.label || item.value)
    .slice(0, 6);
}

function getA2UIChildren(props: Record<string, unknown>): string[] {
  const value = props.children;
  if (
    value &&
    typeof value === 'object' &&
    'explicitList' in value &&
    Array.isArray((value as { explicitList?: unknown }).explicitList)
  ) {
    return (value as { explicitList: unknown[] }).explicitList.filter(
      (item): item is string => typeof item === 'string'
    );
  }
  if (typeof props.child === 'string') {
    return [props.child];
  }
  return [];
}

function getA2UIComponentName(entry: A2UIComponentEntry): string | null {
  if (!entry.component) {
    return null;
  }
  return Object.keys(entry.component)[0] ?? null;
}

function getA2UIComponentProps(
  entry: A2UIComponentEntry,
  name: string | null
): Record<string, unknown> {
  if (!entry.component || !name) {
    return {};
  }
  return entry.component[name] ?? {};
}

function normalizeA2UIValue(value: unknown): string {
  return getA2UIText(value).trim().toLowerCase();
}

function getA2UIButtonIntent(props: Record<string, unknown>): TlonButtonIntent {
  const rawIntent = normalizeA2UIValue(props.intent);
  const actionName =
    typeof props.action === 'object' &&
    props.action &&
    'name' in props.action &&
    typeof (props.action as { name?: unknown }).name === 'string'
      ? (props.action as { name: string }).name.toLowerCase()
      : '';
  const label = getA2UIStringProp(props, ['label', 'text', 'title'])
    .toLowerCase()
    .trim();
  const value = `${rawIntent} ${actionName} ${label}`;

  if (
    value.includes('allow') ||
    value.includes('approve') ||
    value.includes('accept') ||
    value.includes('positive') ||
    value.includes('success')
  ) {
    return 'positive';
  }
  if (
    value.includes('block') ||
    value.includes('deny') ||
    value.includes('reject') ||
    value.includes('delete') ||
    value.includes('negative') ||
    value.includes('destructive')
  ) {
    return 'negative';
  }
  if (value.includes('helper')) {
    return 'helper';
  }
  if (value.includes('secondary') || value.includes('cancel')) {
    return 'secondary';
  }
  return 'primary';
}

function getA2UIButtonFill(props: Record<string, unknown>): TlonButtonFill {
  const rawStyle = normalizeA2UIValue(props.style);
  const rawIntent = normalizeA2UIValue(props.intent);
  const label = getA2UIStringProp(props, ['label', 'text', 'title'])
    .toLowerCase()
    .trim();

  if (rawStyle === 'outline' || rawStyle === 'ghost' || rawStyle === 'text') {
    return rawStyle;
  }
  if (rawIntent === 'secondary') {
    return 'outline';
  }
  if (label.includes('deny')) {
    return 'solid';
  }
  if (label.includes('block') || label.includes('reject')) {
    return 'ghost';
  }
  return 'solid';
}

function getA2UIBadgeType(props: Record<string, unknown>): A2UIBadgeTone {
  const value = getA2UIStringProp(props, ['label', 'text', 'status'])
    .toLowerCase()
    .trim();

  if (
    value.includes('approved') ||
    value.includes('active') ||
    value.includes('success')
  ) {
    return 'positive';
  }
  if (
    value.includes('warning') ||
    value.includes('pending') ||
    value.includes('review')
  ) {
    return 'warning';
  }
  return 'neutral';
}

function getA2UIBadgeColors(tone: A2UIBadgeTone) {
  switch (tone) {
    case 'positive':
      return {
        backgroundColor: '$positiveBackground',
        color: '$positiveActionText',
      };
    case 'warning':
      return {
        backgroundColor: '$shadow',
        color: '$secondaryText',
      };
    case 'neutral':
      return {
        backgroundColor: '$shadow',
        color: '$secondaryText',
      };
  }
}

function getA2UIGap(
  props: Record<string, unknown>,
  fallback: A2UIGapToken
): A2UIGapToken {
  switch (normalizeA2UIValue(props.gap)) {
    case 'xsmall':
    case 'xs':
      return '$xs';
    case 'small':
    case 's':
      return '$s';
    case 'medium':
    case 'm':
      return '$m';
    case 'large':
    case 'l':
      return '$l';
    case 'xlarge':
    case 'xl':
      return '$xl';
    default:
      return fallback;
  }
}

function getA2UIJustify(props: Record<string, unknown>): A2UIJustify {
  switch (normalizeA2UIValue(props.justify)) {
    case 'center':
      return 'center';
    case 'end':
    case 'flex-end':
      return 'flex-end';
    case 'between':
    case 'space-between':
      return 'space-between';
    default:
      return 'flex-start';
  }
}

function getA2UIWeatherEmoji(value: string): string {
  const normalized = value.toLowerCase();

  if (normalized.includes('thunder') || normalized.includes('storm')) {
    return '⛈️';
  }
  if (
    normalized.includes('rain') ||
    normalized.includes('shower') ||
    normalized.includes('drizzle')
  ) {
    return '🌧️';
  }
  if (normalized.includes('snow') || normalized.includes('sleet')) {
    return '❄️';
  }
  if (normalized.includes('partly') || normalized.includes('mostly')) {
    return '⛅';
  }
  if (normalized.includes('cloud') || normalized.includes('overcast')) {
    return '☁️';
  }
  if (
    normalized.includes('fog') ||
    normalized.includes('mist') ||
    normalized.includes('haze')
  ) {
    return '🌫️';
  }
  if (normalized.includes('wind') || normalized.includes('breeze')) {
    return '💨';
  }
  if (normalized.includes('moon') || normalized.includes('night')) {
    return '🌙';
  }
  return '☀️';
}

function isA2UIPlaceholderRequester(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'requester' || normalized === 'unknown requester';
}

function A2UIChildList({
  ids,
  byId,
  dispatchAction,
}: {
  ids: string[];
  byId: Map<string, A2UIComponentEntry>;
  dispatchAction: A2UIActionDispatch;
}) {
  return (
    <>
      {ids.map((id) => {
        const entry = byId.get(id);
        return entry ? (
          <A2UIComponentRenderer
            key={id}
            entry={entry}
            byId={byId}
            dispatchAction={dispatchAction}
          />
        ) : null;
      })}
    </>
  );
}

function A2UIComponentRenderer({
  entry,
  byId,
  dispatchAction,
}: {
  entry: A2UIComponentEntry;
  byId: Map<string, A2UIComponentEntry>;
  dispatchAction: A2UIActionDispatch;
}) {
  const name = getA2UIComponentName(entry);
  const props = getA2UIComponentProps(entry, name);
  const childIds = getA2UIChildren(props);
  const componentId = typeof entry.id === 'string' ? entry.id : 'unknown';

  switch (name) {
    case 'Card':
      return (
        <YStack
          borderWidth={1}
          borderColor="$shadow"
          borderRadius="$l"
          padding="$l"
          gap={getA2UIGap(props, '$m')}
          backgroundColor="$background"
          flexShrink={1}
        >
          <A2UIChildList
            ids={childIds}
            byId={byId}
            dispatchAction={dispatchAction}
          />
        </YStack>
      );
    case 'Column':
      return (
        <YStack gap={getA2UIGap(props, '$m')} flexShrink={1}>
          <A2UIChildList
            ids={childIds}
            byId={byId}
            dispatchAction={dispatchAction}
          />
        </YStack>
      );
    case 'Stack':
      if (normalizeA2UIValue(props.direction) === 'horizontal') {
        return (
          <XStack
            columnGap={getA2UIGap(props, '$m')}
            rowGap="$s"
            flexWrap="wrap"
            flexShrink={1}
          >
            <A2UIChildList
              ids={childIds}
              byId={byId}
              dispatchAction={dispatchAction}
            />
          </XStack>
        );
      }
      return (
        <YStack gap={getA2UIGap(props, '$s')} flexShrink={1}>
          <A2UIChildList
            ids={childIds}
            byId={byId}
            dispatchAction={dispatchAction}
          />
        </YStack>
      );
    case 'Row':
      return (
        <XStack
          columnGap={getA2UIGap(props, '$s')}
          rowGap="$s"
          flexWrap="wrap"
          alignItems="center"
          justifyContent={getA2UIJustify(props)}
        >
          <A2UIChildList
            ids={childIds}
            byId={byId}
            dispatchAction={dispatchAction}
          />
        </XStack>
      );
    case 'Text': {
      const usageHint =
        typeof props.usageHint === 'string' ? props.usageHint : 'body';
      const size =
        usageHint === 'h1'
          ? '$label/3xl'
          : usageHint === 'h2'
            ? '$label/2xl'
            : usageHint === 'h3'
              ? '$label/l'
              : usageHint === 'h4'
                ? '$label/l'
                : usageHint === 'caption'
                  ? '$label/s'
                  : '$body';
      const color = usageHint === 'caption' ? '$tertiaryText' : '$primaryText';
      const weight =
        usageHint === 'h1' ||
        usageHint === 'h2' ||
        usageHint === 'h3' ||
        usageHint === 'h4'
          ? '500'
          : '400';
      return (
        <Text
          size={size}
          color={color}
          fontWeight={weight}
          flexShrink={1}
          flexWrap="wrap"
        >
          {getA2UIText(props.text)}
        </Text>
      );
    }
    case 'Badge': {
      const tone = getA2UIBadgeType(props);
      const colors = getA2UIBadgeColors(tone);
      return (
        <View
          borderRadius="$l"
          paddingHorizontal="$m"
          paddingVertical="$xs"
          backgroundColor={colors.backgroundColor}
          alignSelf="flex-start"
          maxWidth="100%"
        >
          <Text
            size="$label/m"
            color={colors.color}
            numberOfLines={1}
            flexShrink={1}
          >
            {getA2UIStringProp(props, ['label', 'text', 'status'])}
          </Text>
        </View>
      );
    }
    case 'Button':
      return (
        <Button
          label={getA2UIStringProp(props, ['label', 'text', 'title'])}
          size="small"
          intent={getA2UIButtonIntent(props)}
          fill={getA2UIButtonFill(props)}
          disabled={props.disabled === true}
          alignSelf={props.fullWidth === true ? 'stretch' : 'flex-start'}
          onPress={() =>
            dispatchAction(componentId, getA2UIActionSpec(props.action))
          }
        />
      );
    case 'Progress': {
      const rawValue = typeof props.value === 'number' ? props.value : 0;
      const value = Math.max(0, Math.min(100, rawValue));
      return (
        <YStack gap="$s" flexShrink={1}>
          <Text size="$label/m" color="$secondaryText">
            {getA2UIText(props.label)}
          </Text>
          <View
            height={8}
            borderRadius="$l"
            backgroundColor="$shadow"
            overflow="hidden"
          >
            <View
              height={8}
              width={`${value}%`}
              backgroundColor="$positiveActionText"
            />
          </View>
        </YStack>
      );
    }
    case 'Chart':
      return (
        <Text size="$label/s" color="$secondaryText">
          Chart preview
        </Text>
      );
    case 'Table':
      return (
        <Text size="$label/s" color="$secondaryText">
          Table preview
        </Text>
      );
    case 'Divider':
      return <View height={1} backgroundColor="$border" />;
    case 'Spacer':
      return <View height="$s" />;
    case 'Icon':
      return (
        <Text size="$label/l" color="$primaryText">
          {getA2UIMarker({
            emoji: props.emoji,
            icon: getA2UIText(props.name) || props.name,
          })}
        </Text>
      );
    case 'Image':
      return null;
    default:
      return (
        <Text size="$label/s" color="$secondaryText">
          Unsupported A2UI component
        </Text>
      );
  }
}

function A2UIWeatherCard({ block }: { block: cn.A2UIBlockData }) {
  const dataModel = block.a2ui.dataModel;
  const dispatchAction = useA2UIActionDispatcher(block);
  const location = getA2UIModelString(dataModel, 'location', block.a2ui.title);
  const temperature = getA2UIModelString(dataModel, 'temperature');
  const summary = getA2UIModelString(dataModel, 'summary');
  const details = getA2UIModelString(dataModel, 'details');
  const forecast = getA2UIForecast(dataModel);
  const conditionText = [summary, details].filter(Boolean).join(' · ');
  const currentEmoji =
    getA2UIBlockExplicitEmoji(block) ||
    getA2UIWeatherEmoji(conditionText || summary);

  return (
    <YStack
      borderWidth={1}
      borderColor="$shadow"
      borderRadius="$l"
      backgroundColor="$background"
      padding="$2xl"
      gap="$xl"
      flexShrink={1}
    >
      <XStack alignItems="center" columnGap="$m" rowGap="$s" flexWrap="wrap">
        {temperature ? (
          <Text size="$title/l" fontWeight="500" color="$primaryText">
            {temperature}
          </Text>
        ) : null}
        <Text size="$emoji/m" color="$primaryText">
          {currentEmoji}
        </Text>
      </XStack>

      <YStack alignItems="center" gap="$m">
        {location ? (
          <Text
            size="$label/2xl"
            fontWeight="500"
            color="$primaryText"
            textAlign="center"
          >
            {location}
          </Text>
        ) : null}
        {conditionText ? (
          <Text size="$body" color="$secondaryText" textAlign="center">
            {conditionText}
          </Text>
        ) : null}
      </YStack>

      {forecast.length > 0 ? (
        <XStack
          justifyContent="space-between"
          alignItems="flex-start"
          columnGap="$m"
          rowGap="$l"
          flexWrap="wrap"
        >
          {forecast.map((item, index) => (
            <YStack
              key={`${item.day}-${index}`}
              alignItems="center"
              gap="$s"
              minWidth={44}
              flex={1}
            >
              <Text size="$label/m" color="$secondaryText" textAlign="center">
                {item.day}
              </Text>
              <Text size="$emoji/m" color="$primaryText" textAlign="center">
                {getA2UIWeatherEmoji(item.summary)}
              </Text>
              {item.temp ? (
                <Text size="$label/l" color="$primaryText" textAlign="center">
                  {item.temp}
                </Text>
              ) : null}
              {item.summary ? (
                <Text size="$label/s" color="$tertiaryText" textAlign="center">
                  {item.summary}
                </Text>
              ) : null}
            </YStack>
          ))}
        </XStack>
      ) : null}

      <Button
        label="Refresh"
        size="small"
        intent="secondary"
        fill="outline"
        alignSelf="center"
        onPress={() =>
          dispatchAction('refresh', {
            name: 'weather.refresh',
            context: { location },
          })
        }
      />
    </YStack>
  );
}

function A2UIApprovalCard({ block }: { block: cn.A2UIBlockData }) {
  const dataModel = block.a2ui.dataModel;
  const dispatchAction = useA2UIActionDispatcher(block);
  const approvalId = getA2UIModelString(
    dataModel,
    'approvalId',
    'approval-request'
  );
  const approvalType = getA2UIModelString(dataModel, 'approvalType', 'generic');
  const requestingShip = getA2UIModelString(dataModel, 'requestingShip');
  const amount = getA2UIModelString(dataModel, 'amount');
  const reason = getA2UIModelString(dataModel, 'reason', 'Approval requested.');
  const channelNest = getA2UIModelString(dataModel, 'channelNest');
  const groupTitle = getA2UIModelString(dataModel, 'groupTitle');
  const groupFlag = getA2UIModelString(dataModel, 'groupFlag');
  const messagePreview = getA2UIModelString(dataModel, 'messagePreview');
  const marker = getA2UIBlockMarker(block);
  const subjectCandidate =
    amount || groupTitle || groupFlag || channelNest || requestingShip || '';
  const subject = isA2UIPlaceholderRequester(subjectCandidate)
    ? ''
    : subjectCandidate;
  const primaryLabel =
    approvalType === 'dm'
      ? 'Allow DM'
      : approvalType === 'channel'
        ? 'Allow response'
        : approvalType === 'group'
          ? 'Join group'
          : 'Approve';

  return (
    <YStack
      borderWidth={1}
      borderColor="$shadow"
      borderRadius="$l"
      backgroundColor="$background"
      padding="$xl"
      gap="$l"
      flexShrink={1}
    >
      <XStack
        alignItems="center"
        justifyContent={subject ? 'space-between' : 'flex-start'}
        columnGap="$m"
        rowGap="$m"
        flexWrap="wrap"
      >
        <XStack alignItems="center" columnGap="$s" flexShrink={1}>
          {marker ? (
            <Text size="$label/l" color="$primaryText">
              {marker}
            </Text>
          ) : null}
          {subject ? (
            <Text
              size="$label/l"
              fontWeight="500"
              color="$primaryText"
              flexShrink={1}
            >
              {subject}
            </Text>
          ) : null}
        </XStack>
        <View
          borderRadius="$l"
          paddingHorizontal="$m"
          paddingVertical="$xs"
          backgroundColor="$shadow"
        >
          <Text size="$label/m" color="$secondaryText">
            Pending
          </Text>
        </View>
      </XStack>

      {requestingShip &&
      subject !== requestingShip &&
      !isA2UIPlaceholderRequester(requestingShip) ? (
        <Text size="$label/s" color="$tertiaryText">
          Requester: {requestingShip}
        </Text>
      ) : null}

      {reason ? (
        <Text size="$body" color="$primaryText" flexShrink={1}>
          {reason}
        </Text>
      ) : null}

      {messagePreview ? (
        <Text size="$label/s" color="$tertiaryText" flexShrink={1}>
          Preview: {messagePreview}
        </Text>
      ) : null}

      <XStack columnGap="$m" rowGap="$s" flexWrap="wrap" paddingTop="$s">
        <Button
          label={primaryLabel}
          size="small"
          intent="positive"
          onPress={() =>
            dispatchAction('approve', {
              name: 'tlon.approval.approve',
              context: { approvalId, approvalType, requestingShip },
            })
          }
        />
        <Button
          label="Deny"
          size="small"
          intent="negative"
          onPress={() =>
            dispatchAction('deny', {
              name: 'tlon.approval.deny',
              context: { approvalId, approvalType, requestingShip },
            })
          }
        />
        <Button
          label="Block"
          size="small"
          intent="negative"
          fill="ghost"
          onPress={() =>
            dispatchAction('block', {
              name: 'tlon.approval.block',
              context: { approvalId, approvalType, requestingShip },
            })
          }
        />
      </XStack>
    </YStack>
  );
}

function A2UIDashboardCard({ block }: { block: cn.A2UIBlockData }) {
  const dataModel = block.a2ui.dataModel;
  const marker = getA2UIBlockMarker(block);
  const summary = getA2UIModelString(dataModel, 'summary');
  const metrics = getA2UIMetrics(dataModel);
  const series = getA2UISeries(dataModel);
  const rows = getA2UIRows(dataModel);
  const primarySeries = series[0];
  const values = primarySeries?.values ?? [];
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const range = maxValue - minValue || 1;

  return (
    <YStack
      borderWidth={1}
      borderColor="$shadow"
      borderRadius="$l"
      backgroundColor="$background"
      padding="$xl"
      gap="$xl"
      flexShrink={1}
    >
      <XStack alignItems="flex-start" columnGap="$m" flexShrink={1}>
        {marker ? (
          <Text size="$label/l" color="$primaryText" paddingTop="$xs">
            {marker}
          </Text>
        ) : null}
        <YStack gap="$s" flex={1} flexShrink={1}>
          <Text size="$label/l" color="$primaryText" fontWeight="500">
            {block.a2ui.title}
          </Text>
          {summary ? (
            <Text size="$label/m" color="$secondaryText" flexShrink={1}>
              {summary}
            </Text>
          ) : null}
        </YStack>
      </XStack>

      {metrics.length > 0 ? (
        <XStack columnGap="$m" rowGap="$m" flexWrap="wrap">
          {metrics.map((metric, index) => {
            const metricMarker = getA2UIMarker({
              emoji: metric.emoji,
              icon: metric.icon,
            });
            return (
              <YStack
                key={`${metric.label}-${index}`}
                minWidth={86}
                flex={1}
                gap="$xs"
                padding="$m"
                borderRadius="$m"
                backgroundColor="$secondaryBackground"
              >
                <XStack alignItems="center" columnGap="$s">
                  {metricMarker ? (
                    <Text size="$label/m" color="$primaryText">
                      {metricMarker}
                    </Text>
                  ) : null}
                  <Text size="$label/s" color="$tertiaryText">
                    {metric.label}
                  </Text>
                </XStack>
                <Text size="$label/xl" color="$primaryText" fontWeight="500">
                  {metric.value}
                </Text>
                {metric.delta ? (
                  <Text size="$label/s" color="$secondaryText">
                    {metric.delta}
                  </Text>
                ) : null}
              </YStack>
            );
          })}
        </XStack>
      ) : null}

      {values.length > 0 ? (
        <YStack gap="$s">
          <XStack alignItems="flex-end" gap="$xs" height={72}>
            {values.map((value, index) => {
              const height = 16 + ((value - minValue) / range) * 52;
              return (
                <YStack
                  key={`${primarySeries?.label}-${index}`}
                  flex={1}
                  alignItems="center"
                  justifyContent="flex-end"
                  gap="$xs"
                  minWidth={12}
                >
                  <View
                    width="100%"
                    maxWidth={18}
                    height={height}
                    borderRadius="$s"
                    backgroundColor="$positiveActionText"
                  />
                </YStack>
              );
            })}
          </XStack>
          <XStack justifyContent="space-between" columnGap="$s">
            {primarySeries?.labels
              .slice(0, values.length)
              .map((label, index) => (
                <Text
                  key={`${label}-${index}`}
                  size="$label/s"
                  color="$tertiaryText"
                  textAlign="center"
                  flex={1}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              ))}
          </XStack>
        </YStack>
      ) : null}

      {rows.length > 0 ? (
        <YStack gap="$s">
          {rows.map((row, index) => {
            const rowMarker = getA2UIMarker({
              emoji: row.emoji,
              icon: row.icon,
            });
            return (
              <XStack
                key={`${row.label}-${index}`}
                justifyContent="space-between"
                alignItems="center"
                columnGap="$m"
              >
                <XStack alignItems="center" columnGap="$s" flex={1}>
                  {rowMarker ? (
                    <Text size="$label/s" color="$secondaryText">
                      {rowMarker}
                    </Text>
                  ) : null}
                  <Text
                    size="$label/s"
                    color="$secondaryText"
                    flexShrink={1}
                    numberOfLines={1}
                  >
                    {row.detail ? `${row.label} · ${row.detail}` : row.label}
                  </Text>
                </XStack>
                <Text size="$label/m" color="$primaryText" fontWeight="500">
                  {row.value}
                </Text>
              </XStack>
            );
          })}
        </YStack>
      ) : null}
    </YStack>
  );
}

function getA2UIRecipeRenderer(block: cn.A2UIBlockData): React.ReactNode {
  switch (block.a2ui.recipe) {
    case 'weather_card':
      return <A2UIWeatherCard block={block} />;
    case 'approval_card':
      return <A2UIApprovalCard block={block} />;
    case 'data_dashboard':
      return <A2UIDashboardCard block={block} />;
    default:
      return null;
  }
}

export function A2UIBlock({ block }: { block: cn.A2UIBlockData }) {
  const dispatchAction = useA2UIActionDispatcher(block);
  const components = block.a2ui.components.filter(
    (entry): entry is A2UIComponentEntry =>
      Boolean(entry) &&
      typeof entry === 'object' &&
      typeof (entry as A2UIComponentEntry).id === 'string'
  );
  const byId = new Map(
    components.map((entry) => [entry.id as string, entry] as const)
  );
  const root = byId.get(block.a2ui.root);
  const recipeRenderer = getA2UIRecipeRenderer(block);

  return (
    <Reference.Frame>
      <Reference.Header paddingVertical="$l">
        <Reference.Title>
          <Reference.TitleText>{block.a2ui.title}</Reference.TitleText>
        </Reference.Title>
        <Reference.TitleText>A2UI</Reference.TitleText>
      </Reference.Header>
      <Reference.Body padding="$xl" pointerEvents="auto">
        {recipeRenderer ? (
          recipeRenderer
        ) : root ? (
          <A2UIComponentRenderer
            entry={root}
            byId={byId}
            dispatchAction={dispatchAction}
          />
        ) : (
          <Text size="$label/m" color="$secondaryText">
            {block.a2ui.fallbackText ?? 'Unable to render A2UI surface.'}
          </Text>
        )}
      </Reference.Body>
    </Reference.Frame>
  );
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
  a2ui: A2UIBlock,
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
  a2ui: BlockSettings<typeof A2UIBlock>;
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
