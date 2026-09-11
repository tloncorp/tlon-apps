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

Run it unsandboxed, from anywhere in the repository. It exits 0 when every line is `ok` or `note`, and 1 while any line says `fix`.

Unsandboxed because `gh auth status` cannot reach the keyring inside a shell sandbox and reports a false `not authenticated`. It always inspects the source checkout, even when run from a worktree: that is where `apps/tlon-mobile/.env.local` lives, and `stim worktree warm` copies it from there.

## What it checks

| Line | Requirement | `--fix` does |
|---|---|---|
| `gh` | 2.99.0 or newer (the `--attach` upload flag), authenticated | nothing; prints the install or `gh auth login` line |
| `stim` | the `stim` package, 1.1.0 or newer, resolved first on PATH | installs or upgrades `stim`; uninstalls `stim-cli` when that is what resolves |
| `stim skill` | `stim` skill in `~/.agents/skills` or this repo | `npx skills add appandflow/stim -g -y` |
| `agent-device` | installed | `npm install -g agent-device` |
| `agent-device skill` | `agent-device` skill in `~/.agents/skills` or this repo | `npx skills add callstack/agent-device -g -y` |
| `ship login` | `DEFAULT_SHIP_LOGIN_URL` and `DEFAULT_SHIP_LOGIN_ACCESS_CODE` in `apps/tlon-mobile/.env.local` | nothing; they are credentials (see the tlon-workflow skill, Sign in) |
| `stim doctor` | no `costs time` finding in `apps/tlon-mobile` | nothing; prints each finding and its fix |

`--fix` only installs global npm packages and adds skills under `~/.agents/skills`. It touches nothing in this repository.

It deliberately does not run `stim doctor --fix`, which writes `.claude/settings.local.json` -- your own agent permission configuration -- and can delete generated Android `.cxx` directories. Both are decisions for the person running this, not repairs to apply on a tool's say-so. The `stim doctor` line prints what it found and the fix each finding names.

## When a line stays `fix`

The line carries the exact command. Two that need a person: `gh auth login` opens a browser, and the ship login values are credentials nobody but the user should type.

The `ship login` note is worth clearing even though it is only a note. Without those two variables every reproduction that needs a signed-in app stalls on a 2FA code an unattended run cannot read. With them, sign-in is four taps and no typing.
