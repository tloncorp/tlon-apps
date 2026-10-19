import {
  GroupTemplateId,
  groupTemplatesById,
} from '@tloncorp/api/types/groupTemplates';

const E2E_GROUP_HOST = 'e2e';
const E2E_GROUP_PATH = '/group';
// The create sheet takes any non-empty trimmed name; the group meta editor is
// what caps a group name, at 30 characters.
export const E2E_GROUP_TITLE_MAX_LENGTH = 30;

export type E2eGroupCommand = {
  op: 'create-template';
  templateId: GroupTemplateId;
  title: string;
};

export type E2eGroupCommandParse =
  | { ok: true; command: E2eGroupCommand }
  | { ok: false; error: string };

/**
 * Parses `io.tlon.groups://e2e/group?op=create-template&template=<id>&title=<title>`.
 * Returns null for any URL that is not addressed to this command, so other
 * deep links pass through untouched; a malformed command addressed to it is an
 * error, so the flow that sent it fails on a message instead of a timeout.
 */
export function parseE2eGroupCommand(url: string): E2eGroupCommandParse | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.host !== E2E_GROUP_HOST || parsed.pathname !== E2E_GROUP_PATH) {
    return null;
  }

  const op = parsed.searchParams.get('op');
  if (op !== 'create-template') {
    return { ok: false, error: `unknown op "${op ?? ''}"` };
  }

  const templateId = parsed.searchParams.get('template');
  if (
    !templateId ||
    !Object.prototype.hasOwnProperty.call(groupTemplatesById, templateId)
  ) {
    return { ok: false, error: `unknown template "${templateId ?? ''}"` };
  }

  const title = parsed.searchParams.get('title')?.trim() ?? '';
  if (!title) {
    return { ok: false, error: 'title is required' };
  }
  if (title.length > E2E_GROUP_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `title is longer than ${E2E_GROUP_TITLE_MAX_LENGTH} characters`,
    };
  }

  return {
    ok: true,
    command: {
      op: 'create-template',
      templateId: templateId as GroupTemplateId,
      title,
    },
  };
}
