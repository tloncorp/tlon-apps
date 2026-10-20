/**
 * Post-blob entries for `posts send|reply --blob`, `--file` and `--video`:
 * the api's registered entry schemas and append helpers, behind a module the
 * command layer can import (commands take no raw api values).
 */
import {
  PostBlobDataEntrySchema,
  appendFileUploadToPostBlob,
  appendVideoToPostBlob,
} from '@tloncorp/api/client/content-helpers';

import { commandError } from './commands/command';

export { appendFileUploadToPostBlob, appendVideoToPostBlob };

// The registered post-blob entry schemas by their `type` literal. The a2ui
// schema is refined, so its object shape sits one level in.
const BLOB_ENTRY_SCHEMAS: ReadonlyMap<
  string,
  (typeof PostBlobDataEntrySchema.options)[number]
> = new Map(
  PostBlobDataEntrySchema.options.flatMap((schema) => {
    const wrapped = schema as {
      innerType?: () => unknown;
      shape?: { type?: { value?: unknown } };
    };
    const inner = (
      typeof wrapped.innerType === 'function' ? wrapped.innerType() : wrapped
    ) as { shape?: { type?: { value?: unknown } } };
    const type = inner.shape?.type?.value;
    return typeof type === 'string' ? [[type, schema] as const] : [];
  })
);

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
  const known = [...BLOB_ENTRY_SCHEMAS.keys()].join(', ');
  const types = entries.map((entry, index) => {
    const type =
      typeof entry === 'object' && entry !== null
        ? (entry as { type?: unknown }).type
        : undefined;
    const schema =
      typeof type === 'string' ? BLOB_ENTRY_SCHEMAS.get(type) : undefined;
    if (typeof type !== 'string' || !schema) {
      throw commandError(
        `--blob entry ${index} has no known type. Known types: ${known}.`
      );
    }
    const result = schema.safeParse(entry);
    if (!result.success) {
      const fields = [
        ...new Set(
          result.error.issues.map((issue) => issue.path.join('.') || '(entry)')
        ),
      ];
      throw commandError(
        `--blob entry ${index} is not a valid ${type} entry (check: ${fields.join(', ')}). Known types: ${known}.`
      );
    }
    return type;
  });
  return { raw: blob, types };
}
