import type * as db from '@tloncorp/shared/db';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  hasAgentOnboardingFirstEntry,
  hasAgentOnboardingFirstEntryFailed,
  hasAgentOnboardingProvisionAcknowledgement,
} from './agentOnboardingFirstEntry';

function markerPost(key: string, authorId = '~bot'): db.Post {
  return {
    id: key,
    authorId,
    blob: appendToPostBlob(undefined, {
      type: 'tlon-agent-post-marker',
      version: 1,
      key,
    }),
  } as db.Post;
}

function acknowledgementPost(provisionId: string, authorId = '~bot'): db.Post {
  return {
    id: `ack-${provisionId}`,
    authorId,
    blob: appendToPostBlob(undefined, {
      type: 'tlon-agent-provision-ack',
      version: 1,
      provisionId,
      cronJobId: 'cron-1',
    }),
  } as db.Post;
}

describe('hasAgentOnboardingProvisionAcknowledgement', () => {
  it('recognizes an acknowledgement for the current provision', () => {
    expect(
      hasAgentOnboardingProvisionAcknowledgement(
        [acknowledgementPost('provision-1')],
        '~bot',
        'provision-1'
      )
    ).toBe(true);
  });

  it('ignores acknowledgements from another provision or author', () => {
    expect(
      hasAgentOnboardingProvisionAcknowledgement(
        [
          acknowledgementPost('provision-2'),
          acknowledgementPost('provision-1', '~other'),
        ],
        '~bot',
        'provision-1'
      )
    ).toBe(false);
  });
});

describe('hasAgentOnboardingFirstEntry', () => {
  it('recognizes the current channel-wide completion marker', () => {
    expect(
      hasAgentOnboardingFirstEntry([markerPost('first-entry-ping')], '~bot')
    ).toBe(true);
  });

  it('recognizes the legacy provision-scoped completion marker', () => {
    expect(
      hasAgentOnboardingFirstEntry(
        [markerPost('first-entry-ping:provision-1')],
        '~bot',
        'provision-1'
      )
    ).toBe(true);
  });

  it('ignores unrelated and differently scoped markers', () => {
    expect(
      hasAgentOnboardingFirstEntry(
        [
          markerPost('first-entry-pending'),
          markerPost('first-entry-ping:provision-2'),
        ],
        '~bot',
        'provision-1'
      )
    ).toBe(false);
  });

  it('recognizes a failed initial run as terminal for setup activity', () => {
    expect(
      hasAgentOnboardingFirstEntryFailed(
        [markerPost('first-entry-failed')],
        '~bot'
      )
    ).toBe(true);
    expect(
      hasAgentOnboardingFirstEntryFailed(
        [markerPost('first-entry-pending')],
        '~bot'
      )
    ).toBe(false);
  });

  it('ignores completion markers from anyone except the recorded agent', () => {
    expect(
      hasAgentOnboardingFirstEntry(
        [markerPost('first-entry-ping', '~other')],
        '~bot'
      )
    ).toBe(false);
    expect(
      hasAgentOnboardingFirstEntryFailed(
        [markerPost('first-entry-failed', '~other')],
        '~bot'
      )
    ).toBe(false);
  });
});
