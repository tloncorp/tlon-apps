import { getCanonicalPostId } from '@tloncorp/api/client';
import * as store from '@tloncorp/shared/store';
import { Icon, Pressable } from '@tloncorp/ui';
import { useMemo, useState } from 'react';
import { SizableText, XStack, YStack } from 'tamagui';

import {
  TONE_COLORS,
  formatDuration,
  formatToolName,
  formatWallTime,
  persistenceLabel,
  pluralize,
  runKindLabel,
  sourceKindLabel,
  summarizeContext,
  summarizeWrites,
} from './format';
import { parseLensMessageId } from './lensPost';
import {
  DetailRow,
  InspectorSection,
  LensListItem,
  Metric,
  MutedLine,
  PreviewText,
} from './primitives';
import type {
  ContextLens,
  ContextLensOutput,
  ContextLensToolRun,
} from './types';

export type LensMessageTarget = {
  postId: string;
  channelId?: string;
  authorId?: string;
};

export function RunInspector({
  lens,
  onPressMessage,
}: {
  lens: ContextLens;
  onPressMessage?: (target: LensMessageTarget) => void;
}) {
  const sources = lens.context.sources ?? [];
  const includedSources = sources.filter((source) => source.included);
  const excludedSources = sources.filter((source) => !source.included);
  const toolRuns = lens.tools.runs ?? [];
  const outputs = lens.outputs ?? [];
  const persistenceEvents = lens.persistence.events ?? [];

  const triggerMessageId = lens.triggerDetails?.messageId ?? lens.messageId;
  const triggerChannelId = lens.triggerDetails?.conversationId;

  return (
    <YStack gap="$s">
      <InspectorSection title="Trigger">
        <DetailRow label="Run" value={runKindLabel(lens)} />
        {lens.retryOf ? (
          <DetailRow label="Retry of" value={lens.retryOf.slice(0, 8)} />
        ) : null}
        <DetailRow label="Visibility" value={lens.visibility ?? 'owner'} />
        <DetailRow
          label="Message"
          value={triggerMessageId}
          onPress={
            onPressMessage && triggerMessageId && triggerChannelId
              ? () =>
                  onPressMessage({
                    postId: triggerMessageId,
                    channelId: triggerChannelId,
                    authorId: lens.triggerDetails?.authorShip,
                  })
              : undefined
          }
        />
        <DetailRow
          label="Author"
          value={lens.triggerDetails?.authorShip ?? 'unknown'}
        />
        <DetailRow
          label="Conversation"
          value={lens.triggerDetails?.conversationId ?? lens.chatType}
        />
        <DetailRow
          label="Received"
          value={formatWallTime(lens.triggerDetails?.receivedAt)}
        />
        {lens.triggerDetails?.preview ? (
          <PreviewText value={lens.triggerDetails.preview} />
        ) : null}
      </InspectorSection>

      <InspectorSection title="Context">
        <Metric
          label="Included"
          value={pluralize(includedSources.length, 'source')}
        />
        <Metric
          label="Excluded"
          value={pluralize(excludedSources.length, 'source')}
        />
        {sources.length ? (
          <YStack gap="$xs" marginTop="$xs">
            {sources.slice(0, 8).map((source, index) => (
              <LensListItem
                key={`${source.kind}-${source.sourceId ?? source.label}-${index}`}
                title={source.label}
                meta={`${source.included ? 'included' : 'excluded'} · ${sourceKindLabel(source.kind)}`}
                detail={source.reason ?? source.preview ?? 'recorded by run'}
                tone={source.included ? 'neutral' : 'warning'}
              />
            ))}
          </YStack>
        ) : (
          <MutedLine value={summarizeContext(lens)} />
        )}
      </InspectorSection>

      <InspectorSection title="Tools">
        {toolRuns.length ? (
          <YStack gap="$xs">
            {toolRuns.map((run) => (
              <ToolRunItem key={run.id} run={run} />
            ))}
          </YStack>
        ) : (
          <MutedLine value="No tools called" />
        )}
      </InspectorSection>

      <InspectorSection title="Output">
        {outputs.length ? (
          <YStack gap="$xs">
            {outputs.map((output, index) => (
              <OutputItem
                key={`${output.messageId}-${index}`}
                output={output}
                onPressMessage={onPressMessage}
              />
            ))}
          </YStack>
        ) : (
          <MutedLine value="No bot reply recorded yet" />
        )}
      </InspectorSection>

      <InspectorSection title="Persistence">
        {persistenceEvents.length ? (
          <YStack gap="$xs">
            {persistenceEvents.slice(0, 8).map((event, index) => (
              <LensListItem
                key={`${event.kind}-${event.action}-${event.at}-${index}`}
                title={persistenceLabel(event)}
                meta={event.status}
                detail={event.reason ?? event.key ?? formatWallTime(event.at)}
                tone={
                  event.status === 'failed'
                    ? 'negative'
                    : event.status === 'skipped'
                      ? 'warning'
                      : 'positive'
                }
              />
            ))}
          </YStack>
        ) : (
          <MutedLine value={summarizeWrites(lens)} />
        )}
      </InspectorSection>
    </YStack>
  );
}

function ToolRunItem({ run }: { run: ContextLensToolRun }) {
  const [expanded, setExpanded] = useState(false);
  const expandable = Boolean(run.argumentDetail);
  const tone =
    run.status === 'error'
      ? 'negative'
      : run.status === 'blocked'
        ? 'warning'
        : 'positive';
  const detail = run.error
    ? run.error
    : run.argumentSummary
      ? `${run.argumentSummary}${run.durationMs ? ` · ${formatDuration(run.durationMs)}` : ''}`
      : run.durationMs
        ? `${formatDuration(run.durationMs)}${run.phase ? ` · ${run.phase}` : ''}`
        : run.phase ?? 'running';

  const content = (
    <YStack
      gap="$2xs"
      minWidth={0}
      borderLeftWidth={2}
      borderColor={TONE_COLORS[tone]}
      paddingLeft="$s"
      paddingVertical="$2xs"
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$s"
        minWidth={0}
      >
        <SizableText
          size="$s"
          color="$primaryText"
          flex={1}
          minWidth={0}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {`${run.callIndex}. ${formatToolName(run.name)}`}
        </SizableText>
        <XStack alignItems="center" gap="$2xs" flexShrink={0}>
          <SizableText size="$s" color="$tertiaryText">
            {run.status}
          </SizableText>
          {expandable ? (
            <Icon
              type={expanded ? 'ChevronDown' : 'ChevronRight'}
              color="$tertiaryText"
              customSize={[16, 16]}
            />
          ) : null}
        </XStack>
      </XStack>
      <SizableText size="$s" color="$secondaryText">
        {detail}
      </SizableText>
      {expanded && run.argumentDetail ? (
        <PreviewText value={run.argumentDetail} />
      ) : null}
    </YStack>
  );

  if (!expandable) {
    return content;
  }

  return (
    <Pressable
      onPress={() => setExpanded((value) => !value)}
      pressStyle={{ opacity: 0.6 }}
    >
      {content}
    </Pressable>
  );
}

function OutputItem({
  output,
  onPressMessage,
}: {
  output: ContextLensOutput;
  onPressMessage?: (target: LensMessageTarget) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const canonicalId = useMemo(() => {
    try {
      return getCanonicalPostId(output.messageId);
    } catch {
      return null;
    }
  }, [output.messageId]);
  const postQuery = store.usePostWithRelations(
    expanded && canonicalId ? { id: canonicalId } : null
  );
  // The gateway id encodes the bot's send time, but channel posts are keyed
  // by host receipt time, so the direct lookup misses for channel outputs.
  // Fall back to resolving by (channel, author, send time).
  const directMiss = expanded && !postQuery.isLoading && !postQuery.data;
  const parsedId = useMemo(
    () => parseLensMessageId(output.messageId),
    [output.messageId]
  );
  const sentAtQuery = store.usePostBySentAt(
    directMiss && parsedId && output.conversationId
      ? {
          channelId: output.conversationId,
          authorId: parsedId.authorId,
          sentAt: parsedId.sentAt,
        }
      : null
  );
  const resolvedPost = postQuery.data ?? sentAtQuery.data ?? null;
  const fullText = expanded ? resolvedPost?.textContent ?? null : null;

  return (
    <YStack
      gap="$2xs"
      minWidth={0}
      borderLeftWidth={2}
      borderColor={TONE_COLORS.neutral}
      paddingLeft="$s"
      paddingVertical="$2xs"
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$s"
        minWidth={0}
      >
        <SizableText
          size="$s"
          color="$primaryText"
          flex={1}
          minWidth={0}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {output.messageId}
        </SizableText>
        <SizableText size="$s" color="$tertiaryText" flexShrink={0}>
          {`${output.kind} · ${formatWallTime(output.sentAt)}`}
        </SizableText>
      </XStack>
      <SizableText
        size="$s"
        color="$secondaryText"
        numberOfLines={expanded ? undefined : 3}
      >
        {fullText ?? output.preview ?? output.conversationId}
      </SizableText>
      {expanded &&
      !fullText &&
      (postQuery.isLoading || sentAtQuery.isLoading) ? (
        <MutedLine value="Loading full output…" />
      ) : null}
      <XStack gap="$l" marginTop="$2xs">
        <SizableText
          size="$s"
          color="$positiveActionText"
          onPress={() => setExpanded((value) => !value)}
          pressStyle={{ opacity: 0.6 }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </SizableText>
        {onPressMessage ? (
          <SizableText
            size="$s"
            color="$positiveActionText"
            onPress={() =>
              onPressMessage({
                postId: resolvedPost?.id ?? output.messageId,
                channelId: output.conversationId,
              })
            }
            pressStyle={{ opacity: 0.6 }}
          >
            Go to message
          </SizableText>
        ) : null}
      </XStack>
    </YStack>
  );
}
