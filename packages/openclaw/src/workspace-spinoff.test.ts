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
  it('proposes a workspace card rather than creating one', async () => {
    const note = await ownerDmWorkspaceNote(null);
    expect(note).toContain('propose one with tlon_workspace_plan');
    expect(note).toContain('Do not create it yourself');
    expect(note).not.toContain('create-owned');
  });

  it('links an existing workspace by its listed Ref and skips self-introductions', async () => {
    const note = await ownerDmWorkspaceNote(null);
    expect(note).toContain('its `Ref:` path');
    expect(note).toContain('the owner introducing themselves');
  });

  it('turns a tap on an unknown card into no create', async () => {
    const blob = JSON.stringify([
      {
        type: 'tlon-a2ui-selection',
        version: 1,
        surfaceId: 'workspace-plan-unknown',
        componentId: 'create',
        values: ['Create the "X" workspace'],
      },
    ]);
    expect(await ownerDmWorkspaceNote(blob)).toContain(
      'nothing will be created'
    );
  });

  // monitorTlonProvider is not unit-testable, so the gate is pinned at the
  // source level: the note must never reach a group channel, a non-owner, or
  // first-run onboarding, whose skill forbids creating groups.
  it('is appended only to owner DMs outside first-run onboarding', () => {
    expect(monitorSource).toMatch(
      /if \(\s*!isGroup &&\s*!params\.onboardingDmTarget &&\s*currentSettings\.bootstrapComplete !== false &&\s*effectiveOwnerShip &&\s*isOwner\(senderShip\)\s*\) \{\s*bodyWithAttachments \+= await ownerDmWorkspaceNote\(params\.blobField\);\s*\}/
    );
  });
});
