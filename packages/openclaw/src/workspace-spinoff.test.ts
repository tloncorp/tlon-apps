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

  it('keeps a requested schedule on cron rather than in the proposal', async () => {
    const note = await ownerDmWorkspaceNote(null);
    expect(note).toContain('Nor does the card replace a requested action');
    expect(note).toContain('with the cron tool in this turn, before proposing');
    expect(note).toContain("leave it out of the card's task");
    expect(note).toContain(
      '(day, time, zone and UTC offset) as `confirmation`'
    );
  });

  it('hands the answer to the plan, which posts it, and replies with nothing more', async () => {
    const note = await ownerDmWorkspaceNote(null);
    expect(note).toContain(
      'pass your full answer to their message as `answer`'
    );
    expect(note).toContain('the tool posts it after the card');
    expect(note).toContain('Your own reply after the card is not delivered');
  });

  it('links an existing workspace with its tool and skips self-introductions', async () => {
    const note = await ownerDmWorkspaceNote(null);
    expect(note).toContain('link it instead with tlon_workspace_link');
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
