import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Group DMs (clubs) are deprecated; the plugin handles 1:1 DMs only.
// monitorTlonProvider is not unit-testable, so the guards are pinned at the
// source level.
const here = path.dirname(fileURLToPath(import.meta.url));
const monitorSource = fs.readFileSync(path.resolve(here, './index.ts'), 'utf8');

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, start).toBeGreaterThan(-1);
  const to = source.indexOf(end, from + start.length);
  expect(to, end).toBeGreaterThan(from);
  return source.slice(from, to);
}

const chatHandler = between(
  monitorSource,
  'const handleChatFirehose = async',
  '\n    };\n'
);
const writPath = chatHandler.slice(
  chatHandler.indexOf('const whom = event.whom;')
);

describe('group DMs in the chat firehose', () => {
  it('returns on a non-ship whom before anything else reads the writ', () => {
    expect(writPath).toMatch(
      /^const whom = event\.whom;\s*\/\/[^\n]*\n\s*if \(!isDirectDmWhom\(whom\)\) \{[\s\S]*?return;\s*\}/
    );
    const guard = writPath.indexOf('if (!isDirectDmWhom(whom))');
    for (const later of [
      'extractAuthorShip(',
      'extractDmPartnerShip(',
      'sharedOwnerToolPostLedger()',
      'isOwner(',
      'isDmAllowed(',
      'executeApprovalAction(',
      'createPendingApproval(',
      'activityReads.begin(',
      'cacheMessage(',
      'processMessage(',
    ]) {
      const at = writPath.indexOf(later);
      expect(at, later).toBeGreaterThan(guard);
    }
  });

  it('takes the DM peer from whom, never from the writ author', () => {
    expect(writPath).toContain('const senderShip = partnerShip;');
    expect(writPath).not.toMatch(/partnerShip \|\| (authorShip|reactAuthor)/);
  });

  it('records whom on new DM approvals', () => {
    const approval = between(
      writPath,
      'const approval = createPendingApproval(',
      'await queueApprovalRequest(approval);'
    );
    expect(approval).toMatch(/\bwhom,\n/);
  });
});

describe('1:1 DM reactions', () => {
  it('authorize and dispatch as the DM partner', () => {
    const reactions = between(
      writPath,
      'if (dmAddReact || dmDelReact) {',
      'const dmReplyEssay ='
    );
    const gate = reactions.indexOf(
      'if (reactAuthor && reactAuthor !== botShipName) {'
    );
    expect(gate).toBeGreaterThan(-1);
    const body = reactions.slice(gate);
    expect(body).toContain('isOwner(partnerShip)');
    expect(between(body, 'processMessage({', '});')).toContain(
      'senderShip: partnerShip,'
    );
    expect(body.match(/reactAuthor/g)).toHaveLength(2);
  });

  it('drop an unauthorized partner before either reaction branch', () => {
    const reactions = between(
      writPath,
      'if (dmAddReact || dmDelReact) {',
      'const dmReplyEssay ='
    );
    const gate = reactions.indexOf(
      'if (\n              !isDmPartnerAuthorized(\n                partnerShip,\n                effectiveOwnerShip,\n                effectiveDmAllowlist\n              )\n            ) {'
    );
    expect(gate).toBeGreaterThan(-1);
    expect(reactions.slice(gate)).toMatch(
      /^if \(\s*!isDmPartnerAuthorized\([^)]*\)\s*\) \{\s*runtime\.log\?\.\([^;]*\);\s*return;\s*\}/
    );
    for (const later of [
      'executeApprovalAction(',
      'processMessage(',
      'enqueueSystemEvent(',
    ]) {
      expect(reactions.indexOf(later), later).toBeGreaterThan(gate);
    }
  });
});

describe('group DM approvals', () => {
  it('drops a non-1:1 DM approval before acting on it', () => {
    const execute = between(
      monitorSource,
      'async function executeApprovalAction(',
      '\n    }\n'
    );
    const guard = execute.indexOf('if (!isDirectDmApproval(approval)) {');
    expect(guard).toBeGreaterThan(-1);
    expect(execute.slice(guard)).toMatch(
      /^if \(!isDirectDmApproval\(approval\)\) \{[\s\S]*?removePendingApproval\([\s\S]*?return [^;]*;\s*\}/
    );
    for (const later of [
      'addToDmAllowlist(',
      'processMessage(',
      'runBanAction(',
    ]) {
      expect(execute.indexOf(later), later).toBeGreaterThan(guard);
    }
  });

  it('allows but does not replay a DM approval with no recorded whom', () => {
    const execute = between(
      monitorSource,
      'async function executeApprovalAction(',
      '\n    }\n'
    );
    const dm = between(execute, "case 'dm':", "case 'channel':");
    const allow = dm.indexOf(
      'await addToDmAllowlist(approval.requestingShip);'
    );
    const skip = dm.indexOf(
      'if (approval.originalMessage && !approval.originalMessage.whom) {'
    );
    const replay = dm.indexOf('} else if (approval.originalMessage) {');
    expect(allow).toBeGreaterThan(-1);
    expect(skip).toBeGreaterThan(allow);
    expect(replay).toBeGreaterThan(skip);
    expect(dm.slice(skip, replay)).not.toContain('processMessage(');
    expect(dm.indexOf('processMessage(')).toBeGreaterThan(replay);
  });
});
