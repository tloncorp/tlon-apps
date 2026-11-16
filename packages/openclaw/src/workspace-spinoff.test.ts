import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ownerDmWorkspaceNote } from './workspace-spinoff.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const monitorSource = fs.readFileSync(
  path.resolve(here, './monitor/index.ts'),
  'utf8'
);

describe('owner DM workspace note', () => {
  it('makes the owner the admin of a workspace it spins off', () => {
    expect(ownerDmWorkspaceNote('~ten')).toContain(
      'groups create-owned "<title>" --admin ~ten'
    );
  });

  // monitorTlonProvider is not unit-testable, so the gate is pinned at the
  // source level: the note must never reach a group channel, a non-owner, or
  // a first-run onboarding DM, whose skill forbids creating groups.
  it('is appended only to owner DMs outside first-run onboarding', () => {
    expect(monitorSource).toMatch(
      /if \(\s*!isGroup &&\s*!params\.onboardingDmTarget &&\s*effectiveOwnerShip &&\s*isOwner\(senderShip\)\s*\) \{\s*bodyWithAttachments \+= ownerDmWorkspaceNote\(effectiveOwnerShip\);\s*\}/
    );
  });
});
