import { A2UI } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import {
  type AgentServiceSetupToolParams,
  agentServiceSetupToolParameters,
  createAgentServiceSetupToolExecutor,
} from './agent-service-setup-tool.js';
import {
  SupersededTurnError,
  supersededToolResult,
} from './superseded-turn.js';

const validSetup: AgentServiceSetupToolParams = {
  target: 'chat/~zod/home-group-chat',
  providerId: 'google-drive',
};

const noCatalog = async () => null;
const catalog = async () => [
  { id: 'github', name: 'GitHub' },
  { id: 'google-calendar', name: 'Google Calendar' },
  { id: 'google-drive', name: 'Google Drive' },
];

describe('agent service setup tool', () => {
  it('builds a recovery card for the furnished first-run bot DM', async () => {
    const execute = createAgentServiceSetupToolExecutor({
      postSetup: vi.fn(async () => '{}'),
      assertCurrent: vi.fn(),
      listServices: noCatalog,
    });
    const result = await execute('dm-setup', { ...validSetup, target: '~ten' });
    expect(result.details).toEqual({ text: result.content[0].text });
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
    await createAgentServiceSetupToolExecutor({
      postSetup,
      assertCurrent: vi.fn(),
      listServices: noCatalog,
    })('setup', validSetup);
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
    const execute = createAgentServiceSetupToolExecutor({
      postSetup,
      assertCurrent: vi.fn(),
      listServices: noCatalog,
    });

    const result = await execute('call-1', validSetup);

    expect(result.details).toEqual({ text: result.content[0].text });
    expect(postSetup).toHaveBeenCalledOnce();
    expect(postSetup).toHaveBeenCalledWith({
      target: validSetup.target,
      fallbackMessage:
        'Open Connected Services to connect the source you chose. When you return, tap Continue setup or send me a message so I can check the connection and resume. If this account does not support hosted connections, choose another source you can share here.',
      blob: expect.stringContaining('agent-service-setup-call-1'),
    });
  });

  it('ends the turn quietly when a newer owner message supersedes it', async () => {
    const postSetup = vi.fn(async () => '{}');
    const execute = createAgentServiceSetupToolExecutor({
      postSetup,
      assertCurrent: vi.fn(() => {
        throw new SupersededTurnError();
      }),
      listServices: noCatalog,
    });

    const result = await execute('stale-setup', validSetup);

    expect(result).toEqual(supersededToolResult());
    expect(postSetup).not.toHaveBeenCalled();
  });

  it('rejects an invalid target or provider id', async () => {
    const postSetup = vi.fn(async () => 'unexpected');
    const execute = createAgentServiceSetupToolExecutor({
      postSetup,
      assertCurrent: vi.fn(),
      listServices: noCatalog,
    });

    for (const params of [
      { ...validSetup, target: 'dm/~zod' },
      { ...validSetup, providerId: '   ' },
    ]) {
      const result = await execute('call-invalid', params);
      expect(result.details).toMatchObject({ error: true });
    }
    expect(postSetup).not.toHaveBeenCalled();
  });

  it('refuses a service the owner cannot connect and names the ones they can', async () => {
    const postSetup = vi.fn(async () => 'unexpected');
    const result = await createAgentServiceSetupToolExecutor({
      postSetup,
      assertCurrent: vi.fn(),
      listServices: catalog,
    })('call-asana', { ...validSetup, providerId: 'asana' });

    expect(result.details).toMatchObject({ error: true });
    expect(result.content[0]!.text).toContain(
      '"asana" is not a service the owner can connect.'
    );
    expect(result.content[0]!.text).toContain(
      'GitHub (github), Google Calendar (google-calendar), Google Drive (google-drive).'
    );
    expect(postSetup).not.toHaveBeenCalled();
  });

  it("opens the service's real id when the model names it by display name", async () => {
    const postSetup = vi.fn(async () => '{}');
    await createAgentServiceSetupToolExecutor({
      postSetup,
      assertCurrent: vi.fn(),
      listServices: catalog,
    })('call-calendar', { ...validSetup, providerId: 'Google Calendar' });

    expect(postSetup.mock.calls[0]![0].blob).toContain(
      '"providerId":"google-calendar"'
    );
  });

  it('still posts the card when the service list cannot be loaded', async () => {
    const postSetup = vi.fn(async () => '{}');
    const result = await createAgentServiceSetupToolExecutor({
      postSetup,
      assertCurrent: vi.fn(),
      listServices: noCatalog,
    })('call-offline', { ...validSetup, providerId: 'asana' });

    expect(result.details).toEqual({ text: result.content[0].text });
    expect(postSetup.mock.calls[0]![0].blob).toContain('"providerId":"asana"');
  });
});
