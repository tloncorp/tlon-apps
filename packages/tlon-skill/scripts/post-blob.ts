/**
 * Post-blob entries for `posts send|reply --blob`, `--file` and `--video`:
 * the api's registered entry schemas and append helpers, behind a module the
 * command layer can import (commands take no raw api values).
 */
import {
  POST_BLOB_ENTRY_TYPES,
  PostBlobDataEntrySchema,
  appendFileUploadToPostBlob,
  appendVideoToPostBlob,
} from '@tloncorp/api/client/content-helpers';

import { commandError } from './commands/command';

export { appendFileUploadToPostBlob, appendVideoToPostBlob };

type ZodIssue = NonNullable<
  ReturnType<typeof PostBlobDataEntrySchema.safeParse>['error']
>['issues'][number];

const KNOWN_TYPES: ReadonlySet<string> = new Set(POST_BLOB_ENTRY_TYPES);

// The union reports a mismatch as one issue per definition; the definitions
// for other types fail on `type` itself, so only the entry's own type's
// issues name what to fix.
function ownTypeIssues(issues: ZodIssue[]): ZodIssue[] {
  return issues.flatMap((issue) =>
    issue.code === 'invalid_union'
      ? issue.unionErrors
          .filter(
            (error) =>
              !error.issues.some(
                (inner) => inner.path.length === 1 && inner.path[0] === 'type'
              )
          )
          .flatMap((error) => ownTypeIssues(error.issues))
      : [issue]
  );
}

export interface ValidatedBlob {
  // The caller's JSON, sent as given: validation never rewrites an entry.
  raw: string;
  types: string[];
}

// Each entry must be a registered post-blob entry. Errors name the entry's
// index and the failing field paths, never a value from the blob.
export function validatedBlob(blob: string): ValidatedBlob {
  let entries: unknown;
  try {
    entries = JSON.parse(blob);
  } catch {
    entries = undefined;
  }
  if (!Array.isArray(entries)) {
    throw commandError('--blob must be a JSON array of post-blob entries');
  }
  const known = POST_BLOB_ENTRY_TYPES.join(', ');
  const types = entries.map((entry, index) => {
    const type =
      typeof entry === 'object' && entry !== null
        ? (entry as { type?: unknown }).type
        : undefined;
    if (typeof type !== 'string' || !KNOWN_TYPES.has(type)) {
      throw commandError(
        `--blob entry ${index} has no known type. Known types: ${known}.`
      );
    }
    const parsed = PostBlobDataEntrySchema.safeParse(entry);
    if (!parsed.success) {
      const fields = [
        ...new Set(
          ownTypeIssues(parsed.error.issues).map(
            (issue) => issue.path.join('.') || '(entry)'
          )
        ),
      ];
      throw commandError(
        `--blob entry ${index} is not a valid ${type} entry (check: ${fields.join(', ') || '(entry)'}). Known types: ${known}.`
      );
    }
    return parsed.data.type;
  });
  return { raw: blob, types };
}
