import { createSubsystemLogger } from 'openclaw/plugin-sdk/runtime-env';

export const TLON_MESSAGE_JOURNEY_SCHEMA_VERSION = 1;

export type TlonMessageJourneyDestinationKind =
  | 'dm'
  | 'group_channel'
  | 'notebook';

export type TlonMessageJourneyStage =
  | 'plugin_input_observed'
  | 'plugin_input_selected'
  | 'turn_started'
  | 'reply_dispatch_attempted'
  | 'moon_reply_enqueued'
  | 'reply_dispatch_failed';

export type TlonMessageJourneyEvent = {
  accountId?: string | null;
  agentId?: string | null;
  attemptNumber?: number;
  botShip: string;
  destinationKind: TlonMessageJourneyDestinationKind;
  errorKind?: string | null;
  inputMessageId?: string | null;
  outputMessageId?: string | null;
  ownerShip?: string | null;
  peerShip?: string | null;
  runId?: string | null;
  sessionKey?: string | null;
  stage: TlonMessageJourneyStage;
  trigger?: string | null;
};

export type MessageJourneyLoggerLike = {
  info(message: string, meta?: Record<string, unknown>): void;
};

const journeyLogger = createSubsystemLogger('tlon/message-journey');

function normalizeShip(ship: string): string {
  return ship.trim().replace(/^~/, '');
}

/**
 * Emit a content-free, high-cardinality journey record for Loki correlation.
 * Message and run identifiers intentionally live in log attributes, not metric
 * attributes, so they never create Prometheus series cardinality.
 */
export function recordTlonMessageJourneyEvent(
  event: TlonMessageJourneyEvent,
  logger: MessageJourneyLoggerLike = journeyLogger
): void {
  try {
    logger.info(`tlon.message_journey.${event.stage}`, {
      ...(event.accountId
        ? { 'tlon.message_journey.account_id': event.accountId }
        : {}),
      ...(event.agentId
        ? { 'tlon.message_journey.agent_id': event.agentId }
        : {}),
      ...(event.attemptNumber !== undefined
        ? { 'tlon.message_journey.attempt_number': event.attemptNumber }
        : {}),
      'tlon.message_journey.bot_ship': normalizeShip(event.botShip),
      'tlon.message_journey.destination_kind': event.destinationKind,
      ...(event.errorKind
        ? { 'tlon.message_journey.error_kind': event.errorKind }
        : {}),
      'tlon.message_journey.event': event.stage,
      ...(event.inputMessageId
        ? { 'tlon.message_journey.input_message_id': event.inputMessageId }
        : {}),
      ...(event.outputMessageId
        ? { 'tlon.message_journey.output_message_id': event.outputMessageId }
        : {}),
      ...(event.ownerShip
        ? {
            'tlon.message_journey.owner_ship': normalizeShip(event.ownerShip),
          }
        : {}),
      ...(event.peerShip
        ? { 'tlon.message_journey.peer_ship': normalizeShip(event.peerShip) }
        : {}),
      ...(event.runId ? { 'tlon.message_journey.run_id': event.runId } : {}),
      'tlon.message_journey.schema_version':
        TLON_MESSAGE_JOURNEY_SCHEMA_VERSION,
      ...(event.sessionKey
        ? { 'tlon.message_journey.session_key': event.sessionKey }
        : {}),
      ...(event.trigger
        ? { 'tlon.message_journey.trigger': event.trigger }
        : {}),
    });
  } catch {
    // Observability must never alter message processing or delivery.
  }
}
