import { A2UI } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import {
  type AgentServiceSetupToolParams,
  agentServiceSetupToolParameters,
  buildAgentServiceSetupBlob,
  createAgentServiceSetupToolExecutor,
} from './agent-service-setup-tool.js';

const validSetup: AgentServiceSetupToolParams = {
  target: 'chat/~zod/home-group-chat',
  surfaceId: 'agent-service-setup-drive-1',
  providerId: 'google-drive',
};

describe('agent service setup tool', () => {
  it('advertises a bounded provider identity', () => {
    expect(agentServiceSetupToolParameters.properties.providerId).toEqual(
      expect.objectContaining({ type: 'string', maxLength: 500 })
    );
  });

  it('builds a valid recovery card that opens existing connected services', () => {
    const entry = buildAgentServiceSetupBlob(validSetup)[0];

    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    expect(JSON.stringify(entry)).toContain('google-drive');
    expect(JSON.stringify(entry)).toContain('Open Connected Services');
    expect(entry).toEqual(
      expect.objectContaining({
        version: 1,
        storyMode: 'fallback',
        messages: expect.arrayContaining([
          expect.objectContaining({
            updateComponents: expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  id: 'open-settings',
                  component: 'Button',
                  action: {
                    event: {
                      name: A2UI.action.navigate,
                      context: {
                        target: {
                          type: 'screen',
                          screen: 'botMcpSettings',
                          providerId: 'google-drive',
                        },
                      },
                    },
                  },
                }),
              ]),
            }),
          }),
        ]),
      })
    );
  });

  it('posts honest fallback copy with the recovery action', async () => {
    const postSetup = vi.fn(async () => '{"ok":true}');
    const execute = createAgentServiceSetupToolExecutor({ postSetup });

    const result = await execute('call-1', validSetup);

    expect(result.details).toBeUndefined();
    expect(postSetup).toHaveBeenCalledOnce();
    expect(postSetup).toHaveBeenCalledWith({
      target: validSetup.target,
      fallbackMessage:
        'Open Connected Services to connect the source you chose. If this account does not support hosted connections, come back and choose another source you can share here.',
      blob: JSON.stringify(buildAgentServiceSetupBlob(validSetup)),
    });
  });

  it('rejects an invalid target, surface id, or provider id', async () => {
    const postSetup = vi.fn(async () => 'unexpected');
    const execute = createAgentServiceSetupToolExecutor({ postSetup });

    for (const params of [
      { ...validSetup, target: 'dm/~zod' },
      { ...validSetup, surfaceId: 'service-setup-drive' },
      { ...validSetup, providerId: '   ' },
    ]) {
      const result = await execute('call-invalid', params);
      expect(result.details).toEqual({ error: true });
    }
    expect(postSetup).not.toHaveBeenCalled();
  });
});
