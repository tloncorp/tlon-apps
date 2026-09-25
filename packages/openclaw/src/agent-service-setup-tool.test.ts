import { A2UI } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import {
  type AgentServiceSetupToolParams,
  agentServiceSetupToolParameters,
  createAgentServiceSetupToolExecutor,
} from './agent-service-setup-tool.js';

const validSetup: AgentServiceSetupToolParams = {
  target: 'chat/~zod/home-group-chat',
  providerId: 'google-drive',
};

describe('agent service setup tool', () => {
  it('builds a recovery card for the furnished first-run bot DM', async () => {
    const execute = createAgentServiceSetupToolExecutor({
      postSetup: vi.fn(async () => '{}'),
    });
    expect(
      (await execute('dm-setup', { ...validSetup, target: '~ten' })).details
    ).toBeUndefined();
  });
  it('advertises a bounded provider identity', () => {
    expect(agentServiceSetupToolParameters.properties.providerId).toEqual(
      expect.objectContaining({ type: 'string', maxLength: 500 })
    );
    expect(agentServiceSetupToolParameters.properties).not.toHaveProperty(
      'surfaceId'
    );
  });

  it('builds a valid recovery card that opens existing connected services', async () => {
    const postSetup = vi.fn(async () => '{}');
    await createAgentServiceSetupToolExecutor({ postSetup })(
      'setup',
      validSetup
    );
    const entry = JSON.parse(postSetup.mock.calls[0]![0].blob)[0];

    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    expect(JSON.stringify(entry)).toContain('google-drive');
    expect(JSON.stringify(entry)).toContain('Open Connected Services');
    expect(JSON.stringify(entry)).toContain('Continue setup');
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
                expect.objectContaining({
                  id: 'continue-setup',
                  component: 'Button',
                  action: {
                    event: {
                      name: A2UI.action.sendMessage,
                      context: {
                        text: expect.stringContaining(
                          'Check whether the source I chose is connected'
                        ),
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
        'Open Connected Services to connect the source you chose. When you return, tap Continue setup or send me a message so I can check the connection and resume. If this account does not support hosted connections, choose another source you can share here.',
      blob: expect.stringContaining('agent-service-setup-call-1'),
    });
  });

  it('rejects an invalid target or provider id', async () => {
    const postSetup = vi.fn(async () => 'unexpected');
    const execute = createAgentServiceSetupToolExecutor({ postSetup });

    for (const params of [
      { ...validSetup, target: 'dm/~zod' },
      { ...validSetup, providerId: '   ' },
    ]) {
      const result = await execute('call-invalid', params);
      expect(result.details).toEqual({ error: true });
    }
    expect(postSetup).not.toHaveBeenCalled();
  });
});
