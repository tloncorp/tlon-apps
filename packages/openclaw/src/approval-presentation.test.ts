import { describe, expect, it, vi } from 'vitest';

vi.mock('./urbit/blob.js', () => ({
  makeA2UIBlob: vi.fn(
    (surfaceId: string, root: string, components: unknown[]) => ({
      surfaceId,
      root,
      components,
    })
  ),
  serializeBlobField: vi.fn((value: unknown) => JSON.stringify(value)),
}));

import { buildTlonPresentationBlobField } from './approval-presentation.js';

describe('Tlon approval presentation', () => {
  it('maps exact approval commands to A2UI message buttons', () => {
    const command = '/approve abc allow-once';
    const blob = buildTlonPresentationBlobField({
      fallbackText: 'Approval required.',
      presentation: {
        title: 'Exec approval',
        blocks: [
          {
            type: 'buttons',
            buttons: [
              {
                label: 'Allow Once',
                style: 'success',
                action: { type: 'command', command },
              },
            ],
          },
        ],
      },
    });

    expect(blob).toBeDefined();
    expect(JSON.parse(blob!).components).toContainEqual(
      expect.objectContaining({
        component: 'Button',
        action: {
          event: {
            name: 'tlon.sendMessage',
            context: { text: command },
          },
        },
      })
    );
  });
});
