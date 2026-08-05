import { expect, test } from 'vitest';

import { A2UI } from '../client/a2ui';
import {
  MiniAppBundleSchema,
  getMiniAppPostBlob,
  getOnlyMiniAppSnapshotBlob,
} from '../client/content-helpers';
import { convertContent } from '../client/postContent';

test('convertContent renders supported a2ui blob entries before story content', () => {
  const a2ui = {
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'approval-card',
          catalogId: 'tlon.a2ui.basic.v1',
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'approval-card',
          root: 'root',
          components: [
            { id: 'root', component: 'Card', child: 'body' },
            { id: 'body', component: 'Column', children: ['title'] },
            { id: 'title', component: 'Text', text: 'Approve DM?' },
          ],
        },
      },
    ],
  };

  const content = convertContent(
    [{ inline: ['Fallback text'] }],
    JSON.stringify([a2ui])
  );

  expect(content[0]).toEqual({ type: 'a2ui', a2ui });
  expect(content[1]).toMatchObject({ type: 'paragraph' });
});

test('A2UI validation accepts mini app action buttons', () => {
  const a2ui: A2UI.BlobEntry = {
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'mini-app',
          catalogId: 'tlon.a2ui.basic.v1',
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'mini-app',
          root: 'root',
          components: [
            { id: 'root', component: 'Column', children: ['vote'] },
            {
              id: 'vote',
              component: 'Button',
              child: 'vote-label',
              action: {
                event: {
                  name: 'tlon.miniAppAction',
                  data: {
                    appId: '0vmini',
                    action: { kind: 'vote', optionId: 'pizza' },
                  },
                },
              },
            },
            { id: 'vote-label', component: 'Text', text: 'Vote pizza' },
          ],
        },
      },
    ],
  };

  expect(A2UI.validateBlobEntry(a2ui)).toBe(true);
  expect(A2UI.getButtonActions(a2ui).at(0)?.event.name).toBe(
    A2UI.action.miniAppAction
  );
});

test('mini app manifest blobs parse as metadata and keep fallback text', () => {
  const miniApp = {
    type: 'tlon-mini-app',
    version: 1,
    appId: '0vmini',
    runtime: 'js-worker-miniapp-v1',
    title: 'Lunch Picker',
    bundleUri: 'https://example.com/miniapps/lunch.miniapp.json',
    bundleSha256:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    bundleBytes: 1000,
    createdAt: 1779320000000,
  };
  const blob = JSON.stringify([miniApp]);

  const content = convertContent(
    [{ inline: ['Mini app: Lunch Picker'] }],
    blob
  );

  expect(getMiniAppPostBlob(blob)).toMatchObject({
    appId: '0vmini',
    snapshotPolicy: { kind: 'none' },
  });
  expect(content).toHaveLength(1);
  expect(content[0]).toMatchObject({ type: 'paragraph' });
});

test('mini app parsing rejects old inline source manifest shape', () => {
  const oldInlineMiniApp = {
    type: 'tlon-mini-app',
    version: 1,
    appId: '0vmini',
    runtime: 'js-worker-a2ui-v0',
    title: 'Lunch Picker',
    source: 'function reduce() { return {}; }',
    initialState: {},
    initialView: { type: 'a2ui', version: 1, messages: [] },
    createdAt: 1779320000000,
  };

  expect(getMiniAppPostBlob(JSON.stringify([oldInlineMiniApp]))).toBeNull();
});

test('mini app bundle and snapshot shapes parse', () => {
  const bundle = {
    type: 'tlon-mini-app-bundle',
    version: 1,
    appId: '0vmini',
    runtime: 'js-worker-miniapp-v1',
    title: 'Lunch Picker',
    source:
      'export function init() { return { state: {} }; } export function reduce(state) { return { state }; } export function render() { return { summary: "ok" }; }',
    initialState: {},
  };
  const snapshot = {
    type: 'tlon-mini-app-snapshot',
    version: 1,
    appId: '0vmini',
    snapshotId: 'snap-1',
    throughPostId: '170.141.184',
    throughSequence: 3,
    state: { count: 3 },
    stateSha256:
      'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    actionCount: 3,
    createdAt: 1779320000000,
  };

  expect(MiniAppBundleSchema.safeParse(bundle).success).toBe(true);
  expect(getOnlyMiniAppSnapshotBlob(JSON.stringify([snapshot]))).toMatchObject({
    snapshotId: 'snap-1',
  });
});
