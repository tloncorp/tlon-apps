import type { NotesV1PendingWriteCheck } from '@tloncorp/api';

export interface NotesPendingWriteErrorLike {
  requestId?: string;
  status?: string;
  checks: NotesV1PendingWriteCheck[];
}

function assertNever(value: never): never {
  throw new Error(`Unhandled pending-write check: ${JSON.stringify(value)}`);
}

function pendingCheckCommand(check: NotesV1PendingWriteCheck): string {
  switch (check.type) {
    case 'notebook-list':
      return 'tlon notes list';
    case 'notebook-detail':
      return 'tlon notes show <notes-nest-from-list>';
    case 'note-list':
      return `tlon notes notes ${check.nest}`;
    case 'note-detail':
      return `tlon notes note ${check.nest} ${check.noteId ?? '<id-from-list>'}`;
    case 'folder-list':
      return `tlon notes folders ${check.nest}`;
    case 'folder-detail':
      return `tlon notes folder ${check.nest} ${check.folderId ?? '<id-from-list>'}`;
  }
  return assertNever(check);
}

export function formatPendingWriteError(
  error: NotesPendingWriteErrorLike
): string[] {
  const lines = error.requestId
    ? [
        `%notes write request is still pending (request ${error.requestId}); the outcome is unknown and it may still complete.`,
        'Do not retry automatically. Check the request before retrying:',
        `  tlon notes request ${error.requestId}`,
        'If the request is still pending, do not issue the write again.',
        'If the request has completed, inspect whether the write landed:',
      ]
    : [
        '%notes write request is still pending; the outcome is unknown and it may still complete.',
        'Do not retry automatically. No request id was returned, so inspect whether the write landed:',
      ];

  lines.push(
    ...error.checks.map((check) => `  ${pendingCheckCommand(check)}`),
    'Only retry if the request failed or the requested change is not present.'
  );
  return lines;
}

export function pendingWriteCommandErrorMessage(
  error: NotesPendingWriteErrorLike
): string {
  return formatPendingWriteError(error).join('\n');
}
