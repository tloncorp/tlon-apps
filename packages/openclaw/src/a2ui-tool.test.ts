import { A2UI } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import {
  a2uiMessageToolProperty,
  buildA2UIBlobFromToolInput,
  prepareA2UISendPayload,
} from './a2ui-tool.js';
import { tlonMessageActions } from './actions.js';

const richComponents: A2UI.Component[] = [
  { id: 'root', component: 'Card', child: 'body' },
  {
    id: 'body',
    component: 'Column',
    children: ['heading', 'divider', 'metrics', 'image', 'actions'],
  },
  { id: 'heading', component: 'Text', variant: 'h2', text: 'System status' },
  { id: 'divider', component: 'Divider' },
  {
    id: 'metrics',
    component: 'Row',
    justify: 'spaceBetween',
    children: ['statusIcon', 'statusText'],
  },
  { id: 'statusIcon', component: 'Icon', name: 'check' },
  { id: 'statusText', component: 'Text', text: 'All systems operational' },
  {
    id: 'image',
    component: 'Image',
    url: 'https://example.com/status.png',
    description: 'Service health chart',
    variant: 'largeFeature',
  },
  { id: 'actions', component: 'Row', children: ['refresh'] },
  {
    id: 'refresh',
    component: 'Button',
    child: 'refreshLabel',
    variant: 'secondary',
    action: {
      event: {
        name: A2UI.action.sendMessage,
        context: { text: 'Refresh system status' },
      },
    },
  },
  { id: 'refreshLabel', component: 'Text', text: 'Refresh' },
];

describe('OpenClaw A2UI authoring', () => {
  it('wraps a rich catalog graph in the supported Tlon envelope', () => {
    const serialized = buildA2UIBlobFromToolInput({
      root: 'root',
      components: richComponents,
    });
    const [entry] = JSON.parse(serialized) as unknown[];

    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    expect(entry).toMatchObject({
      type: 'a2ui',
      version: 1,
      messages: [
        {
          version: 'v0.9',
          createSurface: { catalogId: 'tlon.a2ui.basic.v1' },
        },
        {
          version: 'v0.9',
          updateComponents: { root: 'root' },
        },
      ],
    });
  });

  it('defaults the graph root to root', () => {
    const [entry] = JSON.parse(
      buildA2UIBlobFromToolInput({ components: richComponents })
    ) as A2UI.BlobEntry[];

    expect(A2UI.getRootComponentId(entry)).toBe('root');
  });

  it.each([
    {
      name: 'duplicate IDs',
      components: [
        { id: 'root', component: 'Text', text: 'one' },
        { id: 'root', component: 'Text', text: 'two' },
      ],
    },
    {
      name: 'missing child reference',
      components: [{ id: 'root', component: 'Card', child: 'missing' }],
    },
    {
      name: 'unknown component',
      components: [{ id: 'root', component: 'Chart', value: 1 }],
    },
  ])('rejects $name before sending', ({ components }) => {
    expect(() => buildA2UIBlobFromToolInput({ components })).toThrow(
      'Invalid Tlon A2UI component graph'
    );
  });

  it('requires readable fallback text', () => {
    expect(() =>
      prepareA2UISendPayload({ text: '   ' }, { components: richComponents })
    ).toThrow('require non-empty message text');
  });

  it('preserves other post-blob entries on the payload', () => {
    const payload = prepareA2UISendPayload(
      {
        text: 'System status: all services are operational.',
        channelData: {
          tlon: {
            blob: JSON.stringify([
              { type: 'tlon-context-lens', version: 1, lensId: 'lens-1' },
            ]),
          },
        },
      },
      { components: richComponents }
    );
    const blob = (payload.channelData?.tlon as { blob: string }).blob;
    const entries = JSON.parse(blob) as Array<{ type: string }>;

    expect(entries.map((entry) => entry.type)).toEqual([
      'tlon-context-lens',
      'a2ui',
    ]);
  });

  it('advertises every supported catalog primitive to the agent', () => {
    const schema = JSON.stringify(a2uiMessageToolProperty);

    for (const component of A2UI.catalog.components) {
      expect(schema).toContain(`"const":"${component}"`);
    }
    expect(schema).toContain('one multiline Text node');
  });

  it('wires the authoring schema and payload builder into message sends', async () => {
    const cfg = {
      channels: {
        tlon: {
          enabled: true,
          ship: '~zod',
          url: 'https://example.com',
          code: 'sample-code',
        },
      },
    } as never;
    const discovery = tlonMessageActions.describeMessageTool({ cfg });

    expect(discovery?.schema).toMatchObject({
      actions: ['send'],
      visibility: 'all-configured',
      properties: { a2ui: expect.any(Object) },
    });

    const payload = await tlonMessageActions.prepareSendPayload!({
      ctx: {
        channel: 'tlon',
        action: 'send',
        cfg,
        params: { a2ui: { components: richComponents } },
      } as never,
      to: '~nec',
      payload: { text: 'System status is healthy.' },
    });
    const blob = (payload?.channelData?.tlon as { blob: string }).blob;
    const [entry] = JSON.parse(blob) as unknown[];

    expect(A2UI.validateBlobEntry(entry)).toBe(true);
  });

  it('rejects A2UI payloads for group-channel targets', () => {
    const cfg = {
      channels: {
        tlon: {
          enabled: true,
          ship: '~zod',
          url: 'https://example.com',
          code: 'sample-code',
        },
      },
    } as never;

    expect(() =>
      tlonMessageActions.prepareSendPayload!({
        ctx: {
          channel: 'tlon',
          action: 'send',
          cfg,
          params: { a2ui: { components: richComponents } },
        } as never,
        to: 'chat/~zod/general',
        payload: { text: 'System status is healthy.' },
      })
    ).toThrow('can only be sent in direct messages');
  });
});
