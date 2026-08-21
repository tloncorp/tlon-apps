export const TLON_REQUEST_INPUT_TOOL_NAME = 'tlon_request_input';
export const TLON_REQUEST_INPUT_EVENT_STREAM = 'tlon.request_input';

const MAX_REQUEST_INPUT_CHARS = 1_000;

export type TlonRequestInputParams = {
  question: string;
};

export function readTlonRequestInputQuestion(params: {
  question?: unknown;
}): string | null {
  const question = params.question;
  if (typeof question !== 'string') {
    return null;
  }
  const trimmed = question.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, MAX_REQUEST_INPUT_CHARS);
}

export function buildTlonRequestInputEventData(
  params: { question?: unknown },
  toolCallId?: string
) {
  const question = readTlonRequestInputQuestion(params);
  if (!question) {
    return null;
  }
  const canonicalToolCallId = toolCallId?.trim() || undefined;
  return {
    phase: 'requested',
    status: 'waiting',
    itemId: `request-input:${canonicalToolCallId ?? 'current'}`,
    title: question,
    source: TLON_REQUEST_INPUT_TOOL_NAME,
    ...(canonicalToolCallId ? { toolCallId: canonicalToolCallId } : {}),
  } as const;
}

export function createTlonRequestInputTool() {
  return {
    name: TLON_REQUEST_INPUT_TOOL_NAME,
    label: 'Request Tlon input',
    description:
      'Record that the current Tlon task is blocked on a required answer from the requester. ' +
      'Use only when known requested work cannot continue without that answer. ' +
      'Do not use for banter, optional follow-up questions, offers, or feedback after completed work. ' +
      'After calling this tool, ask the recorded question in the final reply and stop until a later user message answers it.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          minLength: 1,
          maxLength: MAX_REQUEST_INPUT_CHARS,
          description:
            'The exact concise question whose answer is required before the task can continue.',
        },
      },
      required: ['question'],
      additionalProperties: false,
    },
    execute: async (
      _id: string,
      params: TlonRequestInputParams,
      signal?: AbortSignal
    ) => {
      signal?.throwIfAborted();
      const question = readTlonRequestInputQuestion(params);
      if (!question) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: question must be a non-empty string.',
            },
          ],
          details: { error: true },
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Requester input recorded. Ask that question in the final reply, then stop until the requester answers in a later message.',
          },
        ],
        details: { waitingForRequester: true },
      };
    },
  };
}
