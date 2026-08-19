import {
  createInviteLink,
  enableGroup,
  groupsDescribe,
  scry,
  subscribeOnce,
} from '@tloncorp/api';
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import { extractNormalizedInviteLink } from '@tloncorp/api/client/deeplinks';
import * as fs from 'fs';
import * as os from 'os';

import {
  ensureClient,
  getCredentialResolution,
  hasCliCredentialOverrides,
  setCliCredentialOverrides,
} from './api-client';
import { commandError } from './commands/command';
import type { RawGroupForAdminVerification } from './commands/groups-verification';
import { type InviteLinkDeps, run } from './commands/invite-link';
import { resolveOwnerCredentials } from './commands/owner-credentials';

// Global deadline for the whole flow. Kept inside the harness kill timers at
// their default settings (Hermes 30s, OpenClaw 45s); operators who lower
// those knobs below this get the harness's generic timeout instead.
export const INVITE_LINK_DEADLINE_MS = 25_000;

export function createInviteLinkDeps(): InviteLinkDeps {
  return {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    hasExplicitCredentialOverrides: hasCliCredentialOverrides,
    getResolvedShip: () => getCredentialResolution().config.ship,
    resolveOwner: (currentShip) =>
      resolveOwnerCredentials({
        env: process.env,
        fileExists: (filePath) => fs.existsSync(filePath),
        readFile: (filePath) => fs.readFileSync(filePath, 'utf-8'),
        homeDir: os.homedir(),
        currentShip,
      }),
    applyCredentialOverrides: (overrides) =>
      setCliCredentialOverrides(overrides),
    authenticate: async () => {
      await ensureClient([]);
    },
    scryRawGroup: (flag) =>
      // Failures propagate raw; the command layer owns the 404-vs-transport
      // classification.
      scry<RawGroupForAdminVerification>({
        app: 'groups',
        path: `/v2/ui/groups/${flag}`,
      }),
    scryIdUrl: (flag) =>
      scry<string>({ app: 'reel', path: `/v1/id-url/${flag}` }),
    enableGrouper: async (name) => {
      await enableGroup(name);
    },
    describe: async (flag) => {
      await createInviteLink(flag, groupsDescribe({ inviteType: 'group' }));
    },
    awaitIdLink: (flag, timeoutMs) =>
      subscribeOnce<string>(
        { app: 'reel', path: `/v1/id-link/${flag}` },
        timeoutMs
      ),
    normalizeInviteLink: (url) => extractNormalizedInviteLink(url),
  };
}

export interface RunInviteLinkCommandOptions {
  deadlineMs?: number;
}

export async function runInviteLinkCommand(
  args: string[],
  options: RunInviteLinkCommandOptions = {}
): Promise<number> {
  const deadlineMs = options.deadlineMs ?? INVITE_LINK_DEADLINE_MS;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        commandError(`Invite link retrieval timed out after ${deadlineMs}ms.`)
      );
    }, deadlineMs);
  });

  try {
    return await Promise.race([run(args, createInviteLinkDeps()), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
