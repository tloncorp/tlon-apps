# Agent skills

Version-controlled, **agent-agnostic** skills for working on this repo with a
coding agent (Claude Code, Cursor, or anything that loads
[Agent Skills](https://www.anthropic.com/news/skills)-style `SKILL.md` folders).

Each skill is a plain folder: a `SKILL.md` (YAML frontmatter + Markdown
instructions) plus optional `scripts/` and `references/`. Nothing here needs a
specific agent runtime to read — the instructions call out the *capabilities*
they assume (a shell, filesystem, vision, a Linear integration, GitHub, a
browser-automation tool) and use each agent's own tools for those.

These were distilled from real sessions, so they lead with the traps that
actually cost time rather than generic advice.

## Skills

| Skill | What it does |
|-------|--------------|
| [`mobile-qa/`](mobile-qa/SKILL.md) | Run a mobile QA checklist on a physical **Android** device over `adb`, then triage failures → file Linear issues (with screenshots) → fix → rebuild and verify on-device. |
| [`verify/`](verify/SKILL.md) | Verify web UI changes end-to-end with a single local ship + one vite dev server (lighter than the full `start-playwright-dev.sh` rig). |

Each `SKILL.md` opens with a **"Capabilities this skill assumes"** section — read
that first to know what your agent needs.

## Installing

A skill is just a folder, so installation is "put the folder where your agent
looks for skills":

- **Claude Code** — copy (or symlink) the folder into `~/.claude/skills/`
  (personal) or a repo's `.claude/skills/` (project). Note this repo's
  `.claude/skills/` is git-ignored, which is why the tracked source lives here.
- **Claude.ai / Claude Code "Save skill"** — package it as a `.skill` file (below)
  and use the Save-skill flow.
- **Any other agent** — point it at the folder, or hand it the `SKILL.md`.

### Packaging a `.skill` file

A `.skill` is a zip of the skill folder (folder at the archive root):

```bash
cd tools/agent-skills
zip -r -D -X mobile-qa.skill mobile-qa -x '*.DS_Store'
zip -r -D -X verify.skill    verify    -x '*.DS_Store'
```

## Contributing

Keep these portable: prefer concrete, copy-pasteable shell commands, and when a
step needs an agent capability (viewing an image, calling Linear, driving a
browser), describe the *capability* rather than hard-coding one agent's tool
name. Explain the *why* behind a gotcha so the next reader (human or agent) can
generalize it.
