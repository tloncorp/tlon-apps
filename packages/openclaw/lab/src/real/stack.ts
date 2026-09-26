import { execFileSync, spawnSync } from 'node:child_process';
import { Urbit } from '@tloncorp/api';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT, type PromptSources } from '../config.js';
import type { DeployedAgent } from '../deployed.js';

// The lab's own copy of tlonbot's onboarding sandbox: a separate compose
// project on its own ports, so it never disturbs the `dev` stack someone may
// be testing by hand. tlonbot's control script does the Urbit and OpenClaw
// work; this file only adds what the lab needs on top.

export type StackPorts = {
  zod: number;
  ten: number;
  mug: number;
  gateway: number;
};

const DEFAULT_PORTS: StackPorts = {
  zod: 48080,
  ten: 48081,
  mug: 48082,
  gateway: 48789,
};

// The sandbox's fixed fakezod codes, as tests/dev/onboarding.sh has them.
const OWNER = { ship: '~ten', code: 'lapseg-nolmel-riswen-hopryc' };
const BOT = { ship: '~zod', code: 'lidlut-tabwed-pillex-ridrup' };
// onboarding.sh had a stale ~mug code; this is the one that logs in.
const MUG_CODE = 'ravsut-bolryd-hapsum-pastul';

// Runs inside the ships container: mount a ship's %groups desk, replace it
// with the staged one and commit, through the same loopback dojo the
// sandbox's reset uses.
const INSTALL_DESK = `set -e
ship=$1
lb=$(awk '/loopback/{print $1}' /data/$ship/.http.ports)
dojo() { curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:$lb" -H 'Content-Type: application/json' -d "{\\"source\\":{\\"dojo\\":\\"$1\\"},\\"sink\\":{\\"app\\":\\"hood\\"}}" --max-time 120; }
dojo '+hood/mount %groups' >/dev/null
for i in $(seq 1 60); do [ -f /data/$ship/groups/desk.bill ] && break; sleep 1; done
[ -f /data/$ship/groups/desk.bill ] || { echo "~$ship: mounted desk never appeared" >&2; exit 1; }
sleep 2
find /data/$ship/groups -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a /tmp/lab-groups/. /data/$ship/groups/
dojo '+hood/commit %groups' >/dev/null`;
export const SANDBOX_BOT = '~zod';

const WORKSPACE = '/root/.openclaw/workspace';
const PLUGIN_SKILLS =
  '/root/.openclaw/extensions/tlon-checkout/packages/openclaw/skills';
const BASELINE = '/root/.openclaw/lab-workspace-baseline';

/**
 * The variables the sandbox fills into prompt files, read from its script's
 * envsubst lists so a variable it starts filling can't drift from the lab.
 */
export function sandboxPromptVariables(script: string) {
  const names = new Set<string>();
  for (const [, list] of script.matchAll(/envsubst '([^']*)'/g)) {
    for (const [, name] of list.matchAll(/\$\{([A-Z_]+)\}/g)) names.add(name);
  }
  return [...names];
}

export class LabStack {
  readonly project: string;
  readonly ports: StackPorts;
  readonly container: string;

  constructor(
    readonly tlonbotDir: string,
    options: { project?: string; ports?: Partial<StackPorts> } = {}
  ) {
    this.project = options.project ?? 'onboarding-lab';
    this.ports = { ...DEFAULT_PORTS, ...options.ports };
    this.container = `${this.project}-bot-1`;
  }

  private get script() {
    return path.join(this.tlonbotDir, 'tests/dev/onboarding.sh');
  }

  private env(pluginRef?: string) {
    const gitDir = execFileSync(
      'git',
      [
        '-C',
        REPO_ROOT,
        'rev-parse',
        '--path-format=absolute',
        '--git-common-dir',
      ],
      { encoding: 'utf8' }
    ).trim();
    return {
      ...process.env,
      COMPOSE_PROJECT_NAME: this.project,
      ZOD_PORT: String(this.ports.zod),
      TEN_PORT: String(this.ports.ten),
      MUG_PORT: String(this.ports.mug),
      OPENCLAW_GATEWAY_PORT: String(this.ports.gateway),
      TLON_PLUGIN_GIT_DIR: gitDir,
      ...(pluginRef ? { TLON_PLUGIN_REF: pluginRef } : {}),
    };
  }

  /** Run a tlonbot control-script command; throws with its output tail. */
  control(args: string[], pluginRef?: string) {
    const result = spawnSync('bash', [this.script, ...args], {
      env: this.env(pluginRef),
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.status !== 0) {
      throw new Error(
        `onboarding.sh ${args[0]} failed:\n${output.split('\n').slice(-25).join('\n')}`
      );
    }
    return output;
  }

  /** Run a shell command inside the bot container. */
  bot(command: string, input?: string) {
    return execFileSync(
      'docker',
      ['exec', '-i', this.container, 'sh', '-c', command],
      { encoding: 'utf8', input, maxBuffer: 20 * 1024 * 1024 }
    );
  }

  running() {
    try {
      return (
        execFileSync(
          'docker',
          ['inspect', '-f', '{{.State.Running}}', this.container],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
        ).trim() === 'true'
      );
    } catch {
      return false;
    }
  }

  /** The plugin commit the bot runs. */
  pluginRef() {
    return this.bot(
      'git -C /root/.openclaw/extensions/tlon-checkout rev-parse HEAD'
    ).trim();
  }

  owner() {
    return {
      shipUrl: `http://localhost:${this.ports.ten}`,
      shipName: OWNER.ship,
      code: OWNER.code,
    };
  }

  /**
   * Bring the stack up on `pluginRef` (a commit the container can fetch from
   * this repo's object store), then align it with hosted settings.
   */
  async up(
    pluginRef: string,
    agent: DeployedAgent | undefined,
    proxyPort: number,
    search: boolean,
    campaign: boolean
  ) {
    // Only a change to the plugin's code (or the api it builds with) needs a
    // new container; lab-only commits don't.
    const current = () => (this.running() ? this.pluginRef() : '');
    if (!samePlugin(current(), pluginRef)) {
      try {
        this.control(['start'], pluginRef);
      } catch (error) {
        // A fresh stack fails start's reset check until OpenClaw has linked
        // the plugin skills; that happens below.
        if (!this.running()) throw error;
      }
    }
    await this.installDesk();
    if (!samePlugin(this.pluginRef(), pluginRef)) {
      throw new Error(
        `sandbox runs plugin ${this.pluginRef().slice(0, 10)}, expected ${pluginRef.slice(0, 10)}`
      );
    }
    this.configure(agent, proxyPort, search, campaign);
  }

  /**
   * Settings the local sandbox leaves at its own defaults, set the way hosted
   * tlonbot sets them, plus the proxy that records model traffic.
   */
  configure(
    agent: DeployedAgent | undefined,
    proxyPort: number,
    search: boolean,
    campaign: boolean
  ) {
    const deny = JSON.stringify(agent?.deniedTools ?? []);
    const thinking = JSON.stringify(agent?.thinkingDefault ?? null);
    const baseUrl = JSON.stringify(
      `http://host.docker.internal:${proxyPort}/api/v1`
    );
    this.bot(
      `jq --argjson deny '${deny}' --argjson thinking '${thinking}' --argjson base '${baseUrl}' '
        .tools.deny = ((.tools.deny // []) + $deny | unique)
        | (if $thinking then .agents.defaults.thinkingDefault = $thinking else . end)
        | .models.providers.openrouter.baseUrl = $base
        # Scheduled runs call .models.find on any configured provider.
        | .models.providers.openrouter.models = (.models.providers.openrouter.models // [])
        | .tools.web.fetch.enabled = true
        # Hosted production runs no first-week campaign; the lab turns it on
        # only for runs that simulate tips.
        | .channels.tlon.onboardingCampaign.enabled = ${campaign}
        | (if ${search} then . else
            .tools.web.search.enabled = false
            | .plugins.entries["image-search"].enabled = false
          end)
      ' /root/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json /root/.openclaw/openclaw.json`
    );
    // The gateway links plugin skills when a run first resolves them, but
    // the reset check wants the links already there on a fresh stack. These
    // are the same links OpenClaw generates, and it replaces them freely.
    this.bot(
      `mkdir -p /root/.openclaw/plugin-skills
      for d in ${PLUGIN_SKILLS}/*/; do
        n=$(basename "$d")
        [ -e "/root/.openclaw/plugin-skills/$n" ] || ln -s "\${d%/}" "/root/.openclaw/plugin-skills/$n"
      done`
    );
    this.bot(
      `[ -d ${BASELINE} ] || { mkdir -p ${BASELINE} && cp -a ${WORKSPACE}/. ${BASELINE}/; }`
    );
  }

  private ships(command: string) {
    return execFileSync(
      'docker',
      ['exec', '-i', `${this.project}-ships-1`, 'sh', '-c', command],
      { encoding: 'utf8' }
    );
  }

  /**
   * Put this branch's %groups desk on the ships. Stock sandbox piers run an
   * older desk than the app and plugin code expect, so without this the
   * client's newer endpoints 404. Reinstalls only when the desk changed.
   */
  async installDesk() {
    const identity = execFileSync(
      'git',
      ['-C', REPO_ROOT, 'rev-parse', 'HEAD:desk', 'HEAD:peru.yaml'],
      { encoding: 'utf8' }
    )
      .replace(/\s+/g, ' ')
      .trim();
    const marker = '/data/.lab-desk';
    if (this.ships(`cat ${marker} 2>/dev/null || true`) === identity) return;
    const dir = mkdtempSync(path.join(os.tmpdir(), 'lab-desk-'));
    try {
      execFileSync('bash', ['scripts/sync-deps.sh'], { cwd: REPO_ROOT });
      execFileSync(
        'bash',
        ['scripts/assemble-desk.sh', path.join(dir, 'groups')],
        { cwd: REPO_ROOT }
      );
      // Newer tlonbot checkouts install desks themselves; prefer that.
      if (readFileSync(this.script, 'utf8').includes('install-desk')) {
        this.control(['install-desk', path.join(dir, 'groups')]);
        this.ships(`printf %s '${identity}' > ${marker}`);
        return;
      }
      const container = `${this.project}-ships-1`;
      this.ships('rm -rf /tmp/lab-groups');
      execFileSync('docker', [
        'cp',
        path.join(dir, 'groups'),
        `${container}:/tmp/lab-groups`,
      ]);
      for (const [ship, port, code] of [
        ['zod', this.ports.zod, BOT.code],
        ['ten', this.ports.ten, OWNER.code],
        ['mug', this.ports.mug, MUG_CODE],
      ] as const) {
        execFileSync('docker', ['exec', '-i', container, 'bash', '-s', ship], {
          input: INSTALL_DESK,
        });
        await waitForGroupsV3(`http://localhost:${port}`, code);
      }
      this.ships(`printf %s '${identity}' > ${marker}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  /** The values the sandbox fills into prompt files; others stay literal. */
  substitutions(): Record<string, string> {
    // The sandbox renders ${MODEL} from the gateway config, the rest from
    // the bot container's environment.
    const names = sandboxPromptVariables(
      readFileSync(this.script, 'utf8')
    ).filter((name) => name !== 'MODEL');
    const values = this.bot(
      `printf '%s\\n' ${names.map((name) => `"$${name}"`).join(' ')}`
    ).split('\n');
    const model = this.bot(
      "jq -r '.agents.defaults.model.primary // empty' /root/.openclaw/openclaw.json"
    ).trim();
    return {
      ...Object.fromEntries(names.map((name, i) => [name, values[i] ?? ''])),
      ...(model ? { MODEL: model } : {}),
    };
  }

  /**
   * Settings the sandbox reset leaves behind, which a fresh bot wouldn't
   * have: the channel list and the owner's last-message time.
   */
  private async clearBotSettings() {
    const urbit = new Urbit(`http://localhost:${this.ports.zod}`, BOT.code);
    (urbit as Urbit & { ship: string }).ship = BOT.ship.slice(1);
    await urbit.connect();
    try {
      for (const key of [
        'groupChannels',
        'lastOwnerMessageAt',
        'lastOwnerMessageDate',
      ]) {
        await urbit.poke({
          app: 'settings',
          mark: 'settings-event',
          json: {
            'del-entry': {
              desk: 'moltbot',
              'bucket-key': 'tlon',
              'entry-key': key,
            },
          },
        });
      }
    } finally {
      urbit.delete?.();
    }
  }

  /** Files in the bot's workspace right now. */
  workspaceFiles() {
    return this.bot(`ls -1 ${WORKSPACE}`)
      .split('\n')
      .filter((name) => name.endsWith('.md'));
  }

  openclawVersion() {
    return (
      /\d{4}\.\d+\.\d+/.exec(this.bot('openclaw --version'))?.[0] ?? 'unknown'
    );
  }

  /**
   * Write the variant's copies of the plugin's own skills over the installed
   * ones. tlon-skill ships as a separate package and is left as installed.
   */
  applySkills(sources: PromptSources) {
    const own = new Set(
      this.bot(`ls ${PLUGIN_SKILLS}`).split('\n').filter(Boolean)
    );
    const files = [
      ...sources.skills.map((skill) => ({
        rel: `${skill.dir}/SKILL.md`,
        text: skill.text,
      })),
      ...Object.entries(sources.resources).map(([rel, file]) => ({
        rel,
        text: file.text,
      })),
    ].filter((file) => own.has(file.rel.split('/')[0]));
    for (const file of files) {
      this.bot(
        `mkdir -p "$(dirname '${PLUGIN_SKILLS}/${file.rel}')" && cat > '${PLUGIN_SKILLS}/${file.rel}'`,
        file.text
      );
    }
    return files.map((file) => file.rel);
  }

  /**
   * A clean slate for one conversation: fresh groups and DM state, no
   * session, cron jobs or campaign, and the workspace restored to its
   * baseline plus the variant's prompt files.
   */
  async reset(sources: PromptSources) {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'lab-prompts-'));
    try {
      await this.clearBotSettings();
      for (const [name, file] of Object.entries(sources.prompts)) {
        writeFileSync(path.join(dir, name), file.text);
      }
      this.bot(
        `set -e
        agent=$(jq -r '.agents.list[0].id // "dev"' /root/.openclaw/openclaw.json)
        rm -rf /root/.openclaw/agents/$agent/sessions
        mkdir -p /root/.openclaw/agents/$agent/sessions
        find ${WORKSPACE} -mindepth 1 -maxdepth 1 -exec rm -rf {} +
        cp -a ${BASELINE}/. ${WORKSPACE}/`
      );
      return this.control(['reset', dir]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

/** Where the lab keeps what a real run captured, next to the run record. */
export function captureDir(runDir: string) {
  const dir = path.join(runDir, 'captures');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Wait until a ship serves the %groups endpoints this branch's client uses. */
async function waitForGroupsV3(url: string, code: string) {
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    try {
      const login = await fetch(`${url}/~/login`, {
        method: 'POST',
        body: `password=${code}`,
        redirect: 'manual',
      });
      const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
      const scry = await fetch(`${url}/~/scry/groups/v3/groups.json`, {
        headers: { cookie },
        signal: AbortSignal.timeout(10_000),
      });
      if (scry.ok) return;
    } catch {
      // Busy compiling the desk; keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`${url} never served the new %groups desk`);
}

/** Whether two commits have the same plugin and api code (the lab aside). */
function samePlugin(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    execFileSync(
      'git',
      [
        '-C',
        REPO_ROOT,
        'diff',
        '--quiet',
        a,
        b,
        '--',
        'packages/openclaw',
        ':(exclude)packages/openclaw/lab',
        'packages/api',
      ],
      { stdio: 'ignore' }
    );
    return true;
  } catch {
    return false;
  }
}
