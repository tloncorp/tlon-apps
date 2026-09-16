import { readFile } from 'node:fs/promises';
const skill = new URL('../../.agents/skills/tlon-workflow/', import.meta.url);
export async function qaGuidance({ navigation = false } = {}) {
  const workflow = await readFile(new URL('SKILL.md', skill), 'utf8');
  const section = (n) => {
    const match = workflow.match(
      new RegExp(`### ${n}\\. [\\s\\S]*?(?=\\n### |$)`)
    );
    if (!match) throw new Error(`Missing tlon-workflow step ${n}`);
    return match[0];
  };
  return [
    section(4),
    section(6),
    section(8).slice(section(8).indexOf('**Check every clip')),
    ...(navigation
      ? [
          await readFile(
            new URL('references/driving-the-app.md', skill),
            'utf8'
          ),
        ]
      : []),
  ].join('\n\n');
}
