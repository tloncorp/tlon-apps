import { TLON_A2UI_CATALOG_ID } from '@tloncorp/api';

const MAX_PROVIDER_ID_LENGTH = 500;

export type AgentServiceSetupToolParams = {
  target: string;
  providerId: string;
};

type ResolvedAgentServiceSetupToolParams = AgentServiceSetupToolParams & {
  surfaceId: string;
};

export const agentServiceSetupToolParameters = {
  type: 'object',
  properties: {
    target: {
      type: 'string',
      description: 'Current Tlon chat nest or first-run bot DM target.',
    },
    providerId: {
      type: 'string',
      maxLength: MAX_PROVIDER_ID_LENGTH,
      description:
        'Stable connected-service provider ID matching the owner-chosen service, such as google-drive.',
    },
  },
  required: ['target', 'providerId'],
  additionalProperties: false,
} as const;

function parseParams(
  params: ResolvedAgentServiceSetupToolParams
): ResolvedAgentServiceSetupToolParams {
  if (!/^(?:chat\/~[a-z0-9-]+\/[a-z0-9-]+|~[a-z-]+)$/i.test(params.target)) {
    throw new Error('target must be a chat channel nest or bot DM');
  }
  const providerId = params.providerId.trim();
  if (!providerId || providerId.length > MAX_PROVIDER_ID_LENGTH) {
    throw new Error(
      `providerId must be 1-${MAX_PROVIDER_ID_LENGTH} characters`
    );
  }
  return { ...params, providerId };
}

function recoveryCopy() {
  return (
    'Open Connected Services to connect the source you chose. ' +
    'When you return, tap Continue setup or send me a message so I can check the connection and resume. ' +
    'If this account does not support hosted connections, choose another source you can share here.'
  );
}

function buildAgentServiceSetupBlob(
  input: ResolvedAgentServiceSetupToolParams
) {
  const params = parseParams(input);
  const message = recoveryCopy();
  return [
    {
      type: 'a2ui',
      version: 1,
      storyMode: 'fallback',
      messages: [
        {
          version: 'v0.9',
          createSurface: {
            surfaceId: params.surfaceId,
            catalogId: TLON_A2UI_CATALOG_ID,
          },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: params.surfaceId,
            root: 'root',
            components: [
              {
                id: 'root',
                component: 'Column',
                children: ['message', 'open-settings', 'continue-setup'],
              },
              { id: 'message', component: 'Text', text: message },
              {
                id: 'open-settings',
                component: 'Button',
                child: 'open-settings-label',
                variant: 'primary',
                action: {
                  event: {
                    name: 'tlon.navigate',
                    context: {
                      target: {
                        type: 'screen',
                        screen: 'botMcpSettings',
                        providerId: params.providerId,
                      },
                    },
                  },
                },
              },
              {
                id: 'open-settings-label',
                component: 'Text',
                text: 'Open Connected Services',
              },
              {
                id: 'continue-setup',
                component: 'Button',
                child: 'continue-setup-label',
                variant: 'secondary',
                action: {
                  event: {
                    name: 'tlon.sendMessage',
                    context: {
                      text: 'Continue my daily task setup. Check whether the source I chose is connected; if not, help me choose an available source.',
                    },
                  },
                },
              },
              {
                id: 'continue-setup-label',
                component: 'Text',
                text: 'Continue setup',
              },
            ],
          },
        },
      ],
    },
  ];
}

export function createAgentServiceSetupToolExecutor(deps: {
  postSetup: (input: {
    target: string;
    fallbackMessage: string;
    blob: string;
  }) => Promise<string>;
}) {
  return async function execute(
    id: string,
    params: AgentServiceSetupToolParams
  ) {
    try {
      const blob = buildAgentServiceSetupBlob({
        ...params,
        surfaceId: `agent-service-setup-${id}`,
      });
      const output = await deps.postSetup({
        target: params.target,
        fallbackMessage: recoveryCopy(),
        blob: JSON.stringify(blob),
      });
      return {
        content: [{ type: 'text' as const, text: output }],
        details: undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        details: { error: true },
      };
    }
  };
}
