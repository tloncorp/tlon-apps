import {
  onboardingClientDateTimeNote,
  onboardingDmContextNote,
} from '../../src/onboarding-turn-context.js';
import { OWNER_SHIP, type PromptSources, renderPrompt } from './config.js';
import type { ChatTool } from './openrouter.js';

// OpenClaw injects these workspace files into every run. BOOTSTRAP.md is not
// injected; AGENTS.md tells the bot to read it with the `read` tool.
const INJECTED_WORKSPACE_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'MEMORY.md',
];

export const SKILL_LOCATION =
  '~/.openclaw/plugin-skills/tlon-agent-onboarding/SKILL.md';

function skillDescription(skillText: string) {
  return (
    /^description:\s*(.+)$/m.exec(skillText)?.[1]?.trim() ??
    'First-run onboarding.'
  );
}

export function localTime(timezone: string, now = new Date()) {
  return now.toLocaleString('en-US', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

/**
 * An approximation of the system prompt OpenClaw builds: its own framing is
 * not reproduced exactly, but the workspace files, skill listing and tool
 * guidance are the real ones. The real-stack tier catches what this misses.
 */
export function buildSystemPrompt(input: {
  sources: PromptSources;
  tools: (ChatTool & { guidelines?: string[] })[];
  botModel: string;
  timezone: string;
  now?: Date;
}) {
  const toolLines = input.tools.map(
    (tool) => `- ${tool.function.name}: ${tool.function.description}`
  );
  const guidelines = input.tools.flatMap((tool) => tool.guidelines ?? []);
  const workspace = INJECTED_WORKSPACE_FILES.filter(
    (name) => input.sources.prompts[name]
  ).map(
    (name) =>
      `## ${name}\n\n${renderPrompt(input.sources.prompts[name].text, input.botModel)}`
  );
  return [
    'You are a personal assistant running inside OpenClaw.',
    '',
    '## Tooling',
    'Tool availability (filtered by policy):',
    ...toolLines,
    ...(guidelines.length
      ? ['', 'Tool guidelines:', ...guidelines.map((g) => `- ${g}`)]
      : []),
    '',
    '## Skills (mandatory)',
    'Before replying: scan <available_skills> <description> entries.',
    '- If exactly one skill clearly applies: read its SKILL.md at <location> with `read`, then follow it.',
    '- If none clearly apply: do not read any SKILL.md.',
    '<available_skills>',
    `  <skill><name>tlon-agent-onboarding</name><description>${skillDescription(input.sources.skill.text)}</description><location>${SKILL_LOCATION}</location></skill>`,
    '  <skill><name>tlon-skill</name><description>Tlon CLI syntax reference for reading and administering Tlon data.</description><location>~/.openclaw/plugin-skills/tlon-skill/SKILL.md</location></skill>',
    '</available_skills>',
    '',
    '## Workspace',
    'Your working directory is: /root/.openclaw/workspace',
    '',
    '## Current Date & Time',
    `${localTime(input.timezone, input.now)} (${input.timezone})`,
    '',
    '# Project Context',
    'The following project context files have been loaded:',
    '',
    ...workspace,
    '',
    '## Runtime',
    `Runtime: agent=main | channel=tlon | model=openrouter/${input.botModel}`,
  ].join('\n');
}

/** The owner's message as the gateway hands it to the model. */
export function buildOwnerMessage(input: {
  text: string;
  onboardingActive: boolean;
  timezone: string;
  now?: Date;
}) {
  let body = input.text;
  if (input.onboardingActive) {
    body += onboardingDmContextNote(OWNER_SHIP);
    body += onboardingClientDateTimeNote({
      timezone: input.timezone,
      locale: 'en-US',
    });
  }
  const stamp = (input.now ?? new Date()).toLocaleString('en-US', {
    timeZone: input.timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return `[Tlon ${OWNER_SHIP} ${stamp}] ${body}`;
}
