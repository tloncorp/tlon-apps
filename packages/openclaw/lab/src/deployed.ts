import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PLUGIN_DIR, REPO_ROOT } from './config.js';

// What the deployed bot actually runs, read from the sources that deploy it:
// tlonbot's config bundle and its config builder (entrypoint/tlawn.py). The
// lab takes its model settings from here instead of keeping its own copies,
// and every run records how far what it tests is from what is deployed.

export type DeployedAgent = {
  thinkingDefault?: string;
  deniedTools: string[];
  /** params OpenClaw applies to the bot model, e.g. provider routing. */
  modelParams: { maxTokens?: number; provider?: Record<string, unknown> };
};

export type DeploymentCheck = {
  bundle: string;
  openclaw: { deployed?: string; installed?: string };
  plugin: {
    deployedBranch?: string;
    testedBranch: string;
    testedCommit: string;
    /** Whether plugin code or skills differ from the deployed branch. */
    differs?: boolean;
  };
  prompts: {
    deployed?: string;
    testedCommit: string;
    /** Whether the tested prompts differ from the pinned ones. */
    differs?: boolean;
  };
  agent?: DeployedAgent;
  warnings: string[];
};

const DEFAULT_BUNDLE = 'onboarding-qa-stack';

function git(dir: string, args: string[]) {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

/** True when `git diff` reports changes, undefined when git can't tell. */
function gitDiffers(dir: string, args: string[]) {
  try {
    execFileSync('git', ['-C', dir, 'diff', '--quiet', ...args], {
      stdio: 'ignore',
    });
    return false;
  } catch (error) {
    return (error as { status?: number }).status === 1 ? true : undefined;
  }
}

const TLAWN_SCRIPT = `
import contextlib, io, json, sys
sys.path.insert(0, sys.argv[1])
with contextlib.redirect_stdout(io.StringIO()):
    import tlawn
model = sys.argv[2]
defaults = tlawn.ensure_agent_defaults({"model": {"primary": model}})
params = (defaults.get("models", {}).get(model) or {}).get("params", {})
print(json.dumps({
    "thinkingDefault": defaults.get("thinkingDefault"),
    "deniedTools": sorted(tlawn.TLONBOT_DENIED_TOOLS),
    "modelParams": {k: params[k] for k in ("maxTokens", "provider") if k in params},
}))
`;

/** The hosted agent defaults for `botModel`, computed by tlawn.py itself. */
export function deployedAgent(
  tlonbotDir: string,
  botModel: string
): DeployedAgent | undefined {
  const entrypoint = path.join(tlonbotDir, 'entrypoint');
  if (!existsSync(path.join(entrypoint, 'tlawn.py'))) return undefined;
  const output = execFileSync(
    'python3',
    ['-c', TLAWN_SCRIPT, entrypoint, `openrouter/${botModel}`],
    {
      encoding: 'utf8',
      // tlawn.py reads the ship name while importing.
      env: { ...process.env, URBIT_SHIP: '~zod' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  return JSON.parse(output) as DeployedAgent;
}

function installedOpenclaw() {
  // openclaw's exports map hides package.json, so walk up node_modules.
  for (let dir = PLUGIN_DIR; ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'node_modules/openclaw/package.json');
    if (existsSync(file)) {
      return (JSON.parse(readFileSync(file, 'utf8')) as { version: string })
        .version;
    }
    if (dir === path.dirname(dir)) return undefined;
  }
}

/** Compare what this lab run tests with what the bundle deploys. */
export function checkDeployment(
  tlonbotDir: string,
  botModel: string,
  bundleName = process.env.LAB_BUNDLE ?? DEFAULT_BUNDLE
): DeploymentCheck {
  const bundleFile = path.join(
    tlonbotDir,
    'config-bundles',
    `${bundleName}.json`
  );
  const bundle = existsSync(bundleFile)
    ? (JSON.parse(readFileSync(bundleFile, 'utf8')) as Record<string, string>)
    : {};
  const warnings: string[] = [];
  if (!existsSync(bundleFile)) warnings.push(`No config bundle ${bundleFile}`);

  const openclaw = {
    deployed: bundle.openclaw,
    installed: installedOpenclaw(),
  };
  if (openclaw.deployed && openclaw.deployed !== openclaw.installed) {
    warnings.push(
      `OpenClaw: deployed ${openclaw.deployed}, lab modeled on ${openclaw.installed ?? 'unknown'}`
    );
  }

  const testedBranch = git(REPO_ROOT, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const deployedBranch = bundle['tlon-plugin'];
  const deployedRef = deployedBranch
    ? [`origin/${deployedBranch}`, deployedBranch].find((ref) =>
        git(REPO_ROOT, ['rev-parse', '--verify', '--quiet', ref])
      )
    : undefined;
  const pluginDiffers = deployedRef
    ? gitDiffers(REPO_ROOT, [
        deployedRef,
        '--',
        'packages/openclaw/src',
        'packages/openclaw/skills',
      ])
    : undefined;
  if (deployedBranch && pluginDiffers !== false) {
    warnings.push(
      `Plugin: deployed ${deployedBranch}, lab tests ${testedBranch ?? 'unknown'}${pluginDiffers ? ' (code or skills differ)' : ''}`
    );
  }

  const pin = bundle.prompts?.replace(/^commit:/, '');
  const promptsDiffer = pin
    ? gitDiffers(tlonbotDir, [pin, '--', 'prompts'])
    : undefined;
  if (pin && promptsDiffer !== false) {
    warnings.push(
      `Prompts: deployed tlonbot ${pin.slice(0, 9)}, lab reads the checkout${promptsDiffer ? ' (prompts differ)' : ''}`
    );
  }

  let agent: DeployedAgent | undefined;
  try {
    agent = deployedAgent(tlonbotDir, botModel);
  } catch (error) {
    warnings.push(
      `Could not read hosted agent defaults from tlawn.py: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
    );
  }

  return {
    bundle: bundleName,
    openclaw,
    plugin: {
      deployedBranch,
      testedBranch: testedBranch ?? 'unknown',
      testedCommit: git(REPO_ROOT, ['rev-parse', '--short', 'HEAD']) ?? '',
      differs: pluginDiffers,
    },
    prompts: {
      deployed: pin,
      testedCommit: git(tlonbotDir, ['rev-parse', '--short', 'HEAD']) ?? '',
      differs: promptsDiffer,
    },
    agent,
    warnings,
  };
}

/** OpenRouter request settings matching how OpenClaw calls the bot model. */
export function botRequestSettings(agent: DeployedAgent | undefined) {
  const level = agent?.thinkingDefault;
  const reasoning =
    level && level !== 'off' && level !== 'adaptive'
      ? { effort: level === 'xhigh' ? 'high' : level }
      : undefined;
  return {
    ...(reasoning ? { reasoning } : {}),
    ...(agent?.modelParams.provider
      ? { provider: agent.modelParams.provider }
      : {}),
  };
}
