import { readFile } from 'node:fs/promises';
const skill = new URL('../../.agents/skills/tlon-workflow/', import.meta.url);
export async function qaGuidance({ navigation = false } = {}) {
  return [
    await readFile(new URL('references/pr-reviewer.md', skill), 'utf8'),
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
