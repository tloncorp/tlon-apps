import type { DurableBootstrap, DurableRoomSummary } from './durable';
import {
  createComputingStatus,
  getComputingStatusText,
  serializeComputingStatus,
} from './computingStatus';
import type { PresenceStatus } from './presenceApi';

export function durableComputingPresence(
  bootstrap: DurableBootstrap,
  summaries: DurableRoomSummary[],
  since = Date.now()
): PresenceStatus[] {
  return summaries.flatMap((summary) => {
    const room = bootstrap.rooms.find((room) => room.id === summary.roomId);
    if (!summary.computing || !room || room.left?.includes(bootstrap.user.id))
      return [];
    return (
      summary.computingAgents ??
      (bootstrap.bot ? [bootstrap.bot.contactId] : [])
    ).map((ship) => {
      const progress = summary.computingProgress?.[ship];
      const status = createComputingStatus({
        thinking: true,
        toolCalls: progress?.toolNames.map((toolName) => ({ toolName })),
      });
      return {
        key: {
          context: `/durable/${room.id}`,
          ship,
          topic: 'computing',
        },
        contextId: room.channelId,
        timing: { since, timeout: null },
        display: {
          icon: null,
          text: progress?.commentary || getComputingStatusText(status),
          blob: serializeComputingStatus(status),
        },
      };
    });
  });
}
