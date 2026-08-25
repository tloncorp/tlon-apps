import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { ExecApprovalRequest } from 'openclaw/plugin-sdk/approval-runtime';
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

const request: ExecApprovalRequest = {
  id: 'approval-1',
  request: {
    command: 'echo ok',
    host: 'gateway',
    turnSourceChannel: 'tlon',
    turnSourceTo: 'tlon:chat/~nec/general',
    turnSourceAccountId: 'default',
    turnSourceThreadId: '170.141.184',
  },
  createdAtMs: Date.now(),
  expiresAtMs: Date.now() + 60_000,
};

afterEach(() => effectiveOwnerTesting.clearAll());

describe('Tlon native approval capability', () => {
  it('authorizes only the configured owner', async () => {
    const authorize = tlonApprovalCapability.authorizeActorAction!;
    expect(
      await authorize({
        cfg,
        accountId: 'default',
        senderId: 'zod',
        action: 'approve',
        approvalKind: 'exec',
      })
    ).toEqual({ authorized: true });
    expect(
      await authorize({
        cfg,
        accountId: 'default',
        senderId: '~nec',
        action: 'approve',
        approvalKind: 'plugin',
      })
    ).toEqual(
      expect.objectContaining({
        authorized: false,
      })
    );
  });

  it('uses the process-effective owner for DM routing and authorization', async () => {
    setEffectiveOwnerShip('default', '~ten');
    const targets = await tlonApprovalCapability.native!
      .resolveApproverDmTargets!({
      cfg,
      accountId: 'default',
      approvalKind: 'exec',
      request,
    });
    expect(targets).toEqual([{ to: '~ten' }]);

    const authorization = await tlonApprovalCapability.authorizeActorAction!({
      cfg,
      accountId: 'default',
      senderId: '~ten',
      action: 'approve',
      approvalKind: 'exec',
    });
    expect(authorization).toEqual({ authorized: true });
  });

  it('keeps the originating thread available while preferring owner DM delivery', async () => {
    const capabilities = await tlonApprovalCapability.native!
      .describeDeliveryCapabilities!({
      cfg,
      accountId: 'default',
      approvalKind: 'exec',
      request,
    });
    expect(capabilities).toEqual({
      enabled: true,
      preferredSurface: 'approver-dm',
      supportsOriginSurface: true,
      supportsApproverDmSurface: true,
      notifyOriginWhenDmOnly: true,
    });

    const origin = await tlonApprovalCapability.native!.resolveOriginTarget!({
      cfg,
      accountId: 'default',
      approvalKind: 'exec',
      request,
    });
    expect(origin).toEqual({
      to: 'chat/~nec/general',
      threadId: '170.141.184',
    });
  });
});
