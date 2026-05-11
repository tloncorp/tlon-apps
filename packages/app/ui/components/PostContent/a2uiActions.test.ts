import type * as cn from '@tloncorp/shared/logic';
import { expect, test } from 'vitest';

import { buildA2UIUserActionEnvelope } from './a2uiActions';

const block: cn.A2UIBlockData = {
  type: 'a2ui',
  a2ui: {
    type: 'a2ui',
    version: 1,
    protocolVersion: '0.8',
    catalogId: 'https://tlon.io/catalogs/ochre/v1/catalog.json',
    root: 'root',
    title: 'Approval',
    surfaceId: 'approval-card',
    recipe: 'approval_card',
    components: [],
    dataModel: {
      approvalId: 'approval-123',
      requester: '~sampel-palnet',
    },
  },
};

test('builds canonical A2UI userAction envelopes', () => {
  expect(
    buildA2UIUserActionEnvelope({
      block,
      sourceComponentId: 'approve',
      timestamp: '2026-05-07T15:00:00.000Z',
      action: {
        name: 'tlon.approval.approve',
        context: [
          { key: 'approvalId', value: { path: '/approvalId' } },
          { key: 'requester', value: { dataRef: '/requester' } },
          { key: 'staticValue', value: { literal: 'ok' } },
        ],
      },
    })
  ).toEqual({
    userAction: {
      name: 'tlon.approval.approve',
      surfaceId: 'approval-card',
      sourceComponentId: 'approve',
      timestamp: '2026-05-07T15:00:00.000Z',
      context: {
        approvalId: 'approval-123',
        requester: '~sampel-palnet',
        staticValue: 'ok',
      },
    },
  });
});

test('rejects action specs without a name', () => {
  expect(
    buildA2UIUserActionEnvelope({
      block,
      sourceComponentId: 'approve',
      action: { context: [] },
    })
  ).toBeNull();
});
