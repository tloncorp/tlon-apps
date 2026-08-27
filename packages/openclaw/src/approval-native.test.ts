import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { afterEach, describe, expect, it } from 'vitest';

import { tlonApprovalCapability } from './approval-native.js';
import {
  _testing as effectiveOwnerTesting,
  setEffectiveOwnerShip,
} from './effective-owner.js';

const cfg = {
  channels: {
    tlon: {
      ship: '~bus',
      url: 'http://localhost:8080',
      code: 'lidlut-tabwed-pillex-ridrup',
      ownerShip: '~zod',
    },
  },
} as OpenClawConfig;

afterEach(() => effectiveOwnerTesting.clearAll());

describe('Tlon approval capability', () => {
  it('authorizes only the effective owner', async () => {
    setEffectiveOwnerShip('default', '~ten');
    const authorize = tlonApprovalCapability.authorizeActorAction!;

    expect(
      authorize({
        cfg,
        accountId: 'default',
        senderId: '~ten',
        action: 'approve',
        approvalKind: 'exec',
      })
    ).toEqual({ authorized: true });
    expect(
      authorize({
        cfg,
        accountId: 'default',
        senderId: '~nec',
        action: 'approve',
        approvalKind: 'exec',
      })
    ).toMatchObject({ authorized: false });
  });
});
