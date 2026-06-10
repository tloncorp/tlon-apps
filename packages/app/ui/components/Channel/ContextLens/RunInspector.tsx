import { YStack } from 'tamagui';

import {
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
import {
  DetailRow,
  InspectorSection,
  LensListItem,
  Metric,
  MutedLine,
  PreviewText,
} from './primitives';
import type { ContextLens } from './types';

export function RunInspector({ lens }: { lens: ContextLens }) {
  const sources = lens.context.sources ?? [];
  const includedSources = sources.filter((source) => source.included);
  const excludedSources = sources.filter((source) => !source.included);
  const toolRuns = lens.tools.runs ?? [];
  const outputs = lens.outputs ?? [];
  const persistenceEvents = lens.persistence.events ?? [];

  return (
    <YStack gap="$s">
      <InspectorSection title="Trigger">
        <DetailRow label="Run" value={runKindLabel(lens)} />
        <DetailRow label="Visibility" value={lens.visibility ?? 'owner'} />
        <DetailRow
          label="Message"
          value={lens.triggerDetails?.messageId ?? lens.messageId}
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
              <LensListItem
                key={run.id}
                title={`${run.callIndex}. ${formatToolName(run.name)}`}
                meta={run.status}
                detail={
                  run.error
                    ? run.error
                    : run.argumentSummary
                      ? `${run.argumentSummary}${run.durationMs ? ` · ${formatDuration(run.durationMs)}` : ''}`
                      : run.durationMs
                        ? `${formatDuration(run.durationMs)}${run.phase ? ` · ${run.phase}` : ''}`
                        : run.phase ?? 'running'
                }
                tone={
                  run.status === 'error'
                    ? 'negative'
                    : run.status === 'blocked'
                      ? 'warning'
                      : 'positive'
                }
              />
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
              <LensListItem
                key={`${output.messageId}-${index}`}
                title={output.messageId}
                meta={`${output.kind} · ${formatWallTime(output.sentAt)}`}
                detail={output.preview ?? output.conversationId}
                tone="neutral"
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
