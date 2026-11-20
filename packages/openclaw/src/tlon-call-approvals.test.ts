import { afterEach, describe, expect, it } from 'vitest';

import {
  _testing,
  recordTlonCallApproval,
  takeTlonCallApproval,
} from './tlon-call-approvals.js';

describe('tlon call approvals', () => {
  afterEach(() => _testing.clearAll());

  it('hands the executor the owner run and heartbeat read it was given, once', () => {
    const run = { runId: 'hb-1', sessionKey: 'agent:main:main' };
    recordTlonCallApproval('call-1', 'activity mentions', {
      ownerDefault: true,
      ownerShip: '~zod',
      heartbeatRead: run,
    });
    recordTlonCallApproval('call-2', 'contacts self', {
      ownerDefault: true,
      ownerShip: '~zod',
      ownerRun: run,
    });
    expect(takeTlonCallApproval('call-1', 'activity mentions')).toEqual({
      ownerDefault: true,
      ownerShip: '~zod',
      heartbeatRead: run,
    });
    expect(takeTlonCallApproval('call-2', 'contacts self')).toEqual({
      ownerDefault: true,
      ownerShip: '~zod',
      ownerRun: run,
    });
    expect(takeTlonCallApproval('call-1', 'activity mentions')).toBeUndefined();
  });
});
