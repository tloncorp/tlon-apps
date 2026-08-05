import * as db from '@tloncorp/shared/db';
import type { MiniAppPostBlob } from '@tloncorp/shared/logic';
import { expect, test } from 'vitest';

import {
  type MiniAppJSONValue,
  canonicalMiniAppJSONString,
  fetchMiniAppBundle,
  getLatestValidMiniAppSnapshot,
  getMiniAppActionLog,
  lintMiniAppSource,
  validateMiniAppRenderOutput,
} from './miniAppRuntime';

function actionReply({
  actionCreatedAt = 1,
  actionId,
  actor,
  deliveryStatus,
  id,
  sentAt,
}: {
  actionCreatedAt?: number;
  actionId: string;
  actor: string;
  deliveryStatus?: db.Post['deliveryStatus'];
  id: string;
  sentAt: number;
}): db.Post {
  return {
    id,
    authorId: actor,
    sentAt,
    receivedAt: sentAt,
    deliveryStatus,
    blob: JSON.stringify([
      {
        type: 'tlon-mini-app-action',
        version: 1,
        appId: '0vmini',
        actionId,
        action: { kind: 'vote', actor: 'spoofed' },
        createdAt: actionCreatedAt,
      },
    ]),
  } as db.Post;
}

function snapshotReply({
  actionCount,
  id,
  snapshotId,
  state,
  stateSha256,
  throughPostId,
  throughSequence,
}: {
  actionCount: number;
  id: string;
  snapshotId: string;
  state: unknown;
  stateSha256: string;
  throughPostId: string;
  throughSequence: number;
}): db.Post {
  return {
    id,
    authorId: '~zod',
    sentAt: 1,
    receivedAt: 1,
    blob: JSON.stringify([
      {
        type: 'tlon-mini-app-snapshot',
        version: 1,
        appId: '0vmini',
        snapshotId,
        throughPostId,
        throughSequence,
        state,
        stateSha256,
        actionCount,
        createdAt: 1,
      },
    ]),
  } as db.Post;
}

async function sha256Hex(bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256JSON(value: unknown) {
  return sha256Hex(
    new TextEncoder().encode(
      canonicalMiniAppJSONString(value as MiniAppJSONValue)
    )
  );
}

test('mini app actions sort by canonical post id, not client times', () => {
  const actions = getMiniAppActionLog('0vmini', [
    actionReply({
      actionCreatedAt: 1,
      actionId: 'b',
      actor: '~nec',
      id: '170.141.184.900',
      sentAt: 1,
    }),
    actionReply({
      actionCreatedAt: 99,
      actionId: 'a',
      actor: '~zod',
      id: '170.141.184.100',
      sentAt: 99,
    }),
  ]);

  expect(actions.canonical.map((action) => action.actionId)).toEqual([
    'a',
    'b',
  ]);
  expect(actions.canonical[0].actor).toBe('~zod');
});

test('pending local mini app actions are optimistic, not canonical', () => {
  const actions = getMiniAppActionLog('0vmini', [
    actionReply({
      actionId: 'pending',
      actor: '~zod',
      deliveryStatus: 'pending',
      id: '170.141.184.100',
      sentAt: 1,
    }),
  ]);

  expect(actions.canonical).toHaveLength(0);
  expect(actions.optimistic.map((action) => action.actionId)).toEqual([
    'pending',
  ]);
});

test('mini app source lint rejects escape and ambient APIs', () => {
  expect(
    lintMiniAppSource('export function render() { return globalThis; }')
  ).toMatch(/globalThis/);
  expect(
    lintMiniAppSource('export function render() { return new Date(); }')
  ).toMatch(/Date/);
  expect(
    lintMiniAppSource('export function render() { return performance.now(); }')
  ).toMatch(/performance/);
  expect(
    lintMiniAppSource(
      'export function render() { return crypto.randomUUID(); }'
    )
  ).toMatch(/crypto/);
  expect(
    lintMiniAppSource('export function render() { return { summary: "ok" }; }')
  ).toBeNull();
});

test('mini app render validation accepts known scene animation hooks only', () => {
  expect(
    validateMiniAppRenderOutput('0vmini', {
      visual: {
        type: 'skia-scene-v0',
        width: 160,
        height: 120,
        nodes: [
          {
            type: 'circle',
            x: 44,
            y: 24,
            width: 72,
            height: 72,
            fill: '#d97706',
            animate: 'pop',
            transitionKey: 'count-2',
          },
        ],
      },
    })
  ).toBe(true);

  expect(
    validateMiniAppRenderOutput('0vmini', {
      visual: {
        type: 'skia-scene-v0',
        width: 160,
        height: 120,
        nodes: [
          {
            type: 'circle',
            x: 44,
            y: 24,
            width: 72,
            height: 72,
            fill: '#d97706',
            animate: 'explode',
          },
        ],
      },
    })
  ).toBe(false);
});

test('mini app render validation supports dense hit targets', () => {
  expect(
    validateMiniAppRenderOutput('0vmini', {
      visual: {
        type: 'skia-scene-v0',
        width: 420,
        height: 420,
        nodes: [
          {
            type: 'rect',
            x: 40,
            y: 40,
            width: 320,
            height: 320,
            fill: '#f0d9b5',
          },
          {
            type: 'text',
            x: 75,
            y: 92,
            text: 'N',
            fontSize: 28,
            color: '#111111',
          },
          {
            type: 'hitGrid',
            x: 40,
            y: 40,
            columns: 8,
            rows: 8,
            cellWidth: 40,
            cellHeight: 40,
            label: 'Board',
            action: { kind: 'selectSquare' },
          },
          {
            type: 'hitZone',
            x: 310,
            y: 92,
            width: 54,
            height: 70,
            label: 'Player seat Alice',
            action: { kind: 'selectSeat', seat: 'alice' },
          },
        ],
      },
    })
  ).toBe(true);
});

test('mini app render validation keeps buttons strict and visuals passive', () => {
  expect(
    validateMiniAppRenderOutput('0vmini', {
      visual: {
        type: 'skia-scene-v0',
        width: 160,
        height: 120,
        nodes: [
          {
            type: 'button',
            x: 8,
            y: 8,
            width: 30,
            height: 44,
            label: 'Buy',
            action: { kind: 'buy' },
          },
        ],
      },
    })
  ).toBe(false);

  expect(
    validateMiniAppRenderOutput('0vmini', {
      visual: {
        type: 'skia-scene-v0',
        width: 160,
        height: 120,
        nodes: [
          {
            type: 'rect',
            x: 8,
            y: 8,
            width: 12,
            height: 12,
            fill: '#111111',
            action: { kind: 'tapVisual' },
          },
        ],
      },
    })
  ).toBe(false);
});

test('mini app render validation rejects invalid dense hit targets', () => {
  expect(
    validateMiniAppRenderOutput('0vmini', {
      visual: {
        type: 'skia-scene-v0',
        width: 420,
        height: 420,
        nodes: [
          {
            type: 'hitGrid',
            x: 40,
            y: 40,
            columns: 21,
            rows: 20,
            cellWidth: 16,
            cellHeight: 16,
            label: 'Too many cells',
            action: { kind: 'select' },
          },
        ],
      },
    })
  ).toBe(false);

  expect(
    validateMiniAppRenderOutput('0vmini', {
      visual: {
        type: 'skia-scene-v0',
        width: 160,
        height: 120,
        nodes: [
          {
            type: 'hitZone',
            x: 10,
            y: 10,
            width: 18,
            height: 24,
            label: 'Too small',
            action: { kind: 'select' },
          },
        ],
      },
    })
  ).toBe(false);
});

test('mini app snapshots choose latest valid state by through post id', async () => {
  const olderState = { count: 3 };
  const latestState = { count: 9 };
  const invalidLatestState = { count: 99 };

  const selected = await getLatestValidMiniAppSnapshot('0vmini', [
    snapshotReply({
      actionCount: 3,
      id: 'snapshot-a',
      snapshotId: 'snapshot-a',
      state: olderState,
      stateSha256: await sha256JSON(olderState),
      throughPostId: '170.141.184.100',
      throughSequence: 2,
    }),
    snapshotReply({
      actionCount: 99,
      id: 'snapshot-bad',
      snapshotId: 'snapshot-bad',
      state: invalidLatestState,
      stateSha256: '0'.repeat(64),
      throughPostId: '170.141.184.900',
      throughSequence: 98,
    }),
    snapshotReply({
      actionCount: 9,
      id: 'snapshot-c',
      snapshotId: 'snapshot-c',
      state: latestState,
      stateSha256: await sha256JSON(latestState),
      throughPostId: '170.141.184.500',
      throughSequence: 8,
    }),
  ]);

  expect(selected?.snapshotId).toBe('snapshot-c');
  expect(selected?.state).toEqual(latestState);
});

test('mini app bundle fetch verifies byte count and sha256', async () => {
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
  const bytes = new TextEncoder().encode(JSON.stringify(bundle));
  const manifest: MiniAppPostBlob = {
    type: 'tlon-mini-app',
    version: 1,
    appId: '0vmini',
    runtime: 'js-worker-miniapp-v1',
    title: 'Lunch Picker',
    bundleUri: `data:application/json;base64,${Buffer.from(bytes).toString(
      'base64'
    )}`,
    bundleSha256: await sha256Hex(bytes),
    bundleBytes: bytes.byteLength,
    snapshotPolicy: { kind: 'none' },
  };

  await expect(fetchMiniAppBundle(manifest)).resolves.toMatchObject({
    appId: '0vmini',
    title: 'Lunch Picker',
  });
  await expect(
    fetchMiniAppBundle({ ...manifest, bundleSha256: '0'.repeat(64) })
  ).rejects.toThrow(/SHA-256|mismatch/);
});
