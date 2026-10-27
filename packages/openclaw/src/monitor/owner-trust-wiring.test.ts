import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// monitorTlonProvider is not unit-testable (see bot-info.test.ts), so the
// owner-privilege call sites are pinned at the source level. The decision
// itself is tested in owner-trust.test.ts. A new `isOwner(senderShip)` used
// for privilege, or a role computed from the declared author alone, fails
// here.
const here = path.dirname(fileURLToPath(import.meta.url));
const monitorSource = fs.readFileSync(path.resolve(here, './index.ts'), 'utf8');
const pluginSource = fs.readFileSync(
  path.resolve(here, '../../index.ts'),
  'utf8'
);

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, start).toBeGreaterThan(-1);
  const to = source.indexOf(end, from + start.length);
  expect(to, end).toBeGreaterThan(from);
  return source.slice(from, to);
}

const processMessageBody = between(
  monitorSource,
  'const processMessageInternal = async',
  'core.channel.reply.finalizeInboundContext({'
);
const channelHandler = between(
  monitorSource,
  'const handleChannelsFirehose = async',
  'const handleChatFirehose = async'
);
const chatHandler = between(
  monitorSource,
  'const handleChatFirehose = async',
  '\n    };\n'
);

describe('owner access call sites', () => {
  // Each remaining isOwner( reads the declared author for ACCESS only (or to
  // say that privilege was withheld). Adding one means classifying it here.
  const ACCESS_SITES = [
    // DM invite auto-accept: the inviter is the DM partner.
    'if (isOwner(ship)) {',
    // DM allowlist bypass: the sender is the DM partner.
    '// Owner is always allowed to DM (bypass allowlist)\n        if (isOwner(senderShip)) {',
    // Channel allowlist and approval card bypass.
    '// Owner is always allowed\n        if (isOwner(senderShip)) {',
    // Owner blob engagement.
    'const isOwnerBlob = hasBlob && isOwner(senderShip);',
    // Owner command refusal where privilege is withheld.
    "if (channelSenderRole !== 'owner' && isOwner(senderShip)) {",
    // Owner-only tool refusal text where privilege is withheld.
    "...(senderRole === 'user' && isOwner(senderShip)",
    // Reply Handled: the declared author or DM partner is the owner.
    'ownerClaimed: isOwner(senderShip),',
  ];

  it('uses isOwner only at the classified access sites', () => {
    const calls = monitorSource.match(/\bisOwner\(/g) ?? [];
    // + the definition itself
    expect(calls).toHaveLength(ACCESS_SITES.length + 1);
    for (const site of ACCESS_SITES) {
      expect(monitorSource, site).toContain(site);
    }
  });

  it('never compares a declared sender to the owner ship directly', () => {
    expect(monitorSource).not.toMatch(
      /\b(senderShip|partnerShip|ship) === effectiveOwnerShip\b/
    );
    expect(monitorSource).not.toMatch(
      /effectiveOwnerShip === (senderShip|partnerShip)\b/
    );
    expect(monitorSource).not.toMatch(/isOwner\([^)]*\)\s*\?\s*'owner'/);
  });
});

describe('processMessage sender role', () => {
  it('derives the role from the conversation, not the declared author', () => {
    expect(processMessageBody).toMatch(
      /const trustConversation = isGroup \? \(channelNest \?\? ''\) : senderShip;\s*const ownerTrustSource = ownerTrustSourceFor\(\s*trustConversation,\s*params\.messageOrigin\s*\);\s*const senderRole = resolveSenderRole\(\s*senderShip,\s*ownerTrustSource,\s*ownerTrustContext\s*\);/
    );
    expect(processMessageBody.match(/const senderRole\b/g)).toHaveLength(1);
  });

  it('keys owner activity, owner tools and command authorization on the role', () => {
    const activity = processMessageBody.indexOf('setLastOwnerActivity(');
    const gate = processMessageBody.lastIndexOf(
      "if (senderRole === 'owner') {",
      activity
    );
    expect(gate).toBeGreaterThan(-1);
    expect(
      processMessageBody.slice(gate, activity).match(/\n {6}\}/g)
    ).toBeNull();
    expect(processMessageBody).toMatch(
      /if \(senderRole === 'owner'\) \{\s*const currentLens = contextLenses\.get\(lens\.lensId\);\s*contextLenses\.update\(lens\.lensId, \{\s*tools: \{\s*ownerOnlyAvailable: \[\.\.\.OWNER_ONLY_TOOLS\]/
    );
    expect(processMessageBody).toContain(
      "const senderIsOwner = senderRole === 'owner';"
    );
    expect(processMessageBody).toMatch(
      /setSessionRole\(sessionKey, senderRole\);/
    );
  });

  it('hands core a sender identity that matches the owner only with owner privilege', () => {
    const payload = between(
      monitorSource,
      'core.channel.reply.finalizeInboundContext({',
      '\n      });\n'
    );
    expect(payload).toMatch(
      /SenderId: coreSenderId\(\s*senderShip,\s*senderRole,\s*trustConversation,\s*ownerTrustContext\s*\),/
    );
    expect(payload.match(/SenderId:/g)).toHaveLength(1);
  });

  it('carries edit provenance through the retry seed and dispatch', () => {
    expect(monitorSource).toMatch(/edited: params\.messageOrigin === 'edit',/);
    expect(monitorSource).toMatch(
      /messageOrigin: dispatch\.edited \? 'edit' : 'create',/
    );
    expect(monitorSource).toMatch(
      /if \(dispatch\.isGroup && lens\.retrySeed\?\.edited === undefined\) \{\s*runtime\.log\?\.\(\s*`\[tlon\] Context lens retry \$\{lensId\}: legacy retry seed has no edit provenance; runs without owner privilege`/
    );
  });

  it('reports conversationKind and senderVerified on Reply Handled', () => {
    const start = between(monitorSource, 'telemetry?.startReply({', '});');
    expect(start).toMatch(
      /senderRole,\s*conversationKind,\s*senderVerified,\s*ownerClaimed: isOwner\(senderShip\),/
    );
    expect(processMessageBody).toMatch(
      /const senderVerified = isOwnerPrivilegeTrusted\(\s*ownerTrustSource,/
    );
    expect(processMessageBody).toMatch(
      /const conversationKind = conversationKindOf\(\s*ownerTrustSource,/
    );
  });

  it('marks owner runs without privilege so tool refusals say where tools work', () => {
    expect(monitorSource).toMatch(
      /rememberTlonSessionRunSurface\(runId, route\.sessionKey, \{\s*senderRole,[^}]*senderRole === 'user' && isOwner\(senderShip\)\s*\?\s*\{ ownerUnverified: true \}/
    );
    expect(pluginSource).toMatch(
      /resolveOwnerOnlyToolBlock\(\s*event\.toolName,\s*role,\s*event\.params,\s*\{ ownerUnverified: runSurface\?\.ownerUnverified \}\s*\)/
    );
  });
});

describe('channel firehose', () => {
  const live = between(
    channelHandler,
    'const senderShip = normalizeShip(extractAuthorShip(content?.author));',
    'const completed = await processMessage({'
  );

  it('resolves the sender role from the nest host', () => {
    expect(live).toMatch(
      /const messageSet = isThreadReply \? replySet : postSet;\s*const messageOrigin = channelMessageOrigin\(messageSet\);\s*const channelSenderRole = senderRoleFor\(\s*senderShip,\s*nest,\s*messageOrigin\s*\);/
    );
  });

  it('keys campaign, onboarding and owner-listen on owner privilege', () => {
    expect(live.match(/if \(channelSenderRole === 'owner'\) \{/g)).toHaveLength(
      2
    );
    expect(live).toMatch(
      /ownerShip: ownerPrivilegeTrustedIn\(nest, messageOrigin\)\s*\?\s*effectiveOwnerShip\s*:\s*null,\s*senderShip,/
    );
    expect(live).toMatch(
      /isOwnerListenSlashCommand\(rawText\) &&\s*channelSenderRole === 'owner'/
    );
  });

  it('lets the owner past the allowlist, then refuses owner commands where privilege is withheld', () => {
    const allowlist = live.indexOf('// Owner is always allowed\n');
    const refusal = live.indexOf(
      "if (channelSenderRole !== 'owner' && isOwner(senderShip)) {"
    );
    expect(allowlist).toBeGreaterThan(-1);
    expect(refusal).toBeGreaterThan(allowlist);
    expect(live.slice(refusal)).toMatch(
      /^[^]*?isRegisteredCommandText\(commandText, engagementTokens\(\)\)[^]*?story: markdownToStory\(OWNER_PRIVILEGE_ELSEWHERE_TEXT\),[^]*?\}\);\s*return;\s*\}\s*\}/
    );
    expect(live.indexOf('campaign?.replyContext(nest)')).toBeGreaterThan(
      refusal
    );
  });

  it('dispatches channel reactions with their nest, so the role follows the host', () => {
    const reactions = between(
      channelHandler,
      'dispatchAgent: async',
      'enqueueSystemEvent:'
    );
    expect(reactions).toMatch(/isGroup: true,\s*channelNest: nest,/);
  });
});

describe('chat firehose', () => {
  it('keys owner approvals, onboarding and campaign on the DM partner role', () => {
    expect(chatHandler).toMatch(
      /isAdd &&\s*senderRoleFor\(partnerShip, partnerShip, 'create'\) === 'owner'/
    );
    expect(chatHandler).toMatch(
      /const fromOwner =\s*senderRoleFor\(senderShip, senderShip, 'create'\) === 'owner';/
    );
    expect(chatHandler).toMatch(
      /authorShip === effectiveOwnerShip &&\s*senderRoleFor\(senderShip, senderShip, 'create'\) === 'owner'/
    );
    expect(chatHandler).toContain('const senderShip = partnerShip;');
  });
});

describe('onboarding reconciliation', () => {
  it('scans only conversations where owner privilege is trusted', () => {
    const scan = between(
      monitorSource,
      'const scanAgentOnboardingNest = async',
      'onboardingCatchUp = createAgentOnboardingCatchUpScheduler('
    );
    const gate = scan.indexOf(
      "if (!ownerPrivilegeTrustedIn(nest, 'create')) {"
    );
    expect(gate).toBeGreaterThan(-1);
    expect(scan.indexOf('findOnboardingRequestInChannel(')).toBeGreaterThan(
      gate
    );
    expect(scan.indexOf('scanAgentOnboardingChannel(')).toBeGreaterThan(gate);
  });
});
