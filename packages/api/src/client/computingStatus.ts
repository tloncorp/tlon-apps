const COMPUTING_STATUS_PROTOCOL = 'tlon.computing-status.v1' as const;

const TOOL_LABELS: Record<string, string> = {
  exec: 'Running a command',
  read: 'Reading files',
  web_fetch: 'Checking the web',
};

export interface ComputingToolCall {
  toolName: string;
  label: string;
}

export interface ComputingStatus {
  protocol: typeof COMPUTING_STATUS_PROTOCOL;
  thinking: boolean;
  toolCalls: ComputingToolCall[];
}

export const formatComputingToolCallLabel = (toolName?: string | null) => {
  if (!toolName) {
    return 'Using a tool';
  }

  return TOOL_LABELS[toolName] ?? `Using ${toolName.replaceAll('_', ' ')}`;
};

export const createComputingStatus = ({
  thinking,
  toolCalls = [],
}: {
  thinking: boolean;
  toolCalls?: Array<{
    toolName?: string | null;
    label?: string | null;
  }>;
}): ComputingStatus => {
  const seen = new Set<string>();

  return {
    protocol: COMPUTING_STATUS_PROTOCOL,
    thinking,
    toolCalls: toolCalls.flatMap((toolCall) => {
      const toolName = toolCall.toolName?.trim();
      if (!toolName || seen.has(toolName)) {
        return [];
      }

      seen.add(toolName);
      return [
        {
          toolName,
          label:
            toolCall.label?.trim() || formatComputingToolCallLabel(toolName),
        },
      ];
    }),
  };
};

export const getComputingStatusText = (
  status: Pick<ComputingStatus, 'thinking' | 'toolCalls'>
) => {
  if (status.toolCalls.length === 1) {
    return status.toolCalls[0].label;
  }

  if (status.toolCalls.length > 1) {
    return 'Using tools...';
  }

  return status.thinking ? 'Thinking...' : null;
};

export const serializeComputingStatus = (status: {
  thinking: boolean;
  toolCalls?: Array<{
    toolName?: string | null;
    label?: string | null;
  }>;
}) => JSON.stringify(createComputingStatus(status));

export const parseComputingStatus = (
  blob: string | null | undefined
): ComputingStatus | null => {
  if (!blob) {
    return null;
  }

  try {
    const value = JSON.parse(blob) as {
      protocol?: unknown;
      thinking?: unknown;
      toolCalls?: unknown;
    };

    if (
      value.protocol !== COMPUTING_STATUS_PROTOCOL ||
      typeof value.thinking !== 'boolean' ||
      !Array.isArray(value.toolCalls)
    ) {
      return null;
    }

    return createComputingStatus({
      thinking: value.thinking,
      toolCalls: value.toolCalls.flatMap((toolCall) => {
        if (!toolCall || typeof toolCall !== 'object') {
          return [];
        }

        const toolName = 'toolName' in toolCall ? toolCall.toolName : undefined;
        const label = 'label' in toolCall ? toolCall.label : undefined;

        return [
          {
            toolName: typeof toolName === 'string' ? toolName : undefined,
            label: typeof label === 'string' ? label : undefined,
          },
        ];
      }),
    });
  } catch {
    return null;
  }
};

export { COMPUTING_STATUS_PROTOCOL };
