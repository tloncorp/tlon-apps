---
name: tlon-workflow-doctor
description: Use when setting up a machine for mobile agent work on this repository, when the tlon-workflow skill's prerequisite check fails, or when stim, agent-device, gh, or their skills are missing, outdated, or installed under an old name.
---

# Tlon workflow doctor

One script checks everything the mobile agent loop depends on, and installs what it can.

```bash
node .agents/skills/tlon-workflow-doctor/check.mjs          # report
node .agents/skills/tlon-workflow-doctor/check.mjs --fix    # install and re-check
```

Run it from the main checkout, unsandboxed. It exits 0 when every line is `ok` or `note`, and 1 while any line says `fix`.

Unsandboxed because `gh auth status` cannot reach the keyring inside a shell sandbox and reports a false `not authenticated`. From the main checkout because the ship-login check reads `apps/tlon-mobile/.env.local`, which a fresh worktree does not have until `stim worktree warm`.

## What it checks

| Line | Requirement | `--fix` does |
|---|---|---|
| `gh` | 2.99.0 or newer (the `--attach` upload flag), authenticated | nothing; prints the install or `gh auth login` line |
| `stim config` | `~/.stim/config.json` names no path that no longer exists | nothing; prints the dead key |
| `stim` | the `stim` package, 1.0.0 or newer, resolved first on PATH | uninstalls `stim-cli`, installs `stim` |
| `stim skill` | `stim` skill in `~/.agents/skills` or this repo | `npx skills add appandflow/stim -g -y` |
| `agent-device` | installed | `npm install -g agent-device` |
| `agent-device skill` | `agent-device` skill in `~/.agents/skills` or this repo | `npx skills add callstack/agent-device -g -y` |
| `node` | major version matches `.nvmrc` | nothing; a note |
| `ship login` | `DEFAULT_SHIP_LOGIN_URL` and `DEFAULT_SHIP_LOGIN_ACCESS_CODE` in `apps/tlon-mobile/.env.local` | nothing; they are credentials (see the tlon-workflow skill, Sign in) |
| `stim doctor` | no `costs time` finding in `apps/tlon-mobile` | `stim doctor --fix` when a finding is one it repairs (the sandbox allowance); otherwise prints each finding's fix |

`--fix` installs global npm packages, adds skills under `~/.agents/skills`, and runs `stim doctor --fix`. It writes nothing else in this repository.

Two things about that last one. `stim doctor --fix` writes `.claude/settings.local.json`, which is your own agent permission configuration -- decide that yourself rather than because a tool asked. And with `--platform android` it can delete generated `.cxx` directories, so do not run it while a native build is in flight.

## When a line stays `fix`

The line carries the exact command. Two that need a person: `gh auth login` opens a browser, and the ship login values are credentials nobody but the user should type.

The `ship login` note is worth clearing even though it is only a note. Without those two variables every reproduction that needs a signed-in app stalls on a 2FA code an unattended run cannot read. With them, sign-in is four taps and no typing.
