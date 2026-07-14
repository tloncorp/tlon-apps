import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';

import { formatUd, parsePostPayload, renderHistoryContent } from './history.js';
import {
  type ParsedCite,
  extractCites,
  extractMessageText,
  sanitizeMessageText,
} from './utils.js';

type CiteScryApi = {
  scry: (
    path: string,
    opts?: { timeoutMs?: number; signal?: AbortSignal }
  ) => Promise<unknown>;
};

type ResolveCitesOptions = {
  runtime?: RuntimeEnv;
  maxAttempts?: number;
  deadlineMs?: number;
  signal?: AbortSignal;
};

const NEST_PATTERN = /^(?:chat|heap|diary)\/~[a-z-]+\/[a-zA-Z0-9-]+$/;
const UNDOTTED_UD_PATTERN = /^(0|[1-9][0-9]*)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStory(value: unknown): value is unknown[] {
  return (
    Array.isArray(value) &&
    value.every(
      (verse) =>
        isRecord(verse) &&
        (Array.isArray(verse.inline) || isRecord(verse.block))
    )
  );
}

function isCanonicalUd(id: string): boolean {
  const undotted = id.replace(/\./g, '');
  if (!UNDOTTED_UD_PATTERN.test(undotted)) {
    return false;
  }
  return !id.includes('.') || id === formatUd(undotted);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }
  throw (
    signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
  );
}

export function validatedCiteScryPath(cite: ParsedCite): string | null {
  if (
    cite.type !== 'chan' ||
    !cite.nest ||
    !NEST_PATTERN.test(cite.nest) ||
    !cite.postId ||
    !isCanonicalUd(cite.postId) ||
    (cite.replyId !== undefined && !isCanonicalUd(cite.replyId))
  ) {
    return null;
  }

  const postId = formatUd(cite.postId);
  if (!cite.replyId) {
    return `/channels/v4/${cite.nest}/posts/post/${postId}.json`;
  }

  return `/channels/v4/${cite.nest}/posts/post/id/${postId}/replies/reply/id/${formatUd(cite.replyId)}.json`;
}

export async function resolveCites(
  api: CiteScryApi,
  content: unknown,
  opts: ResolveCitesOptions = {}
): Promise<string> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const deadlineMs = opts.deadlineMs ?? 5_000;
  throwIfAborted(opts.signal);

  if (maxAttempts <= 0 || deadlineMs <= 0) {
    return '';
  }

  const validCites = extractCites(content).flatMap((cite) => {
    const path = validatedCiteScryPath(cite);
    return path ? [{ path }] : [];
  });
  if (validCites.length === 0) {
    return '';
  }

  const startedAt = Date.now();
  const deadline = new AbortController();
  const timeoutId = setTimeout(() => deadline.abort(), deadlineMs);
  const lines: string[] = [];
  let attempts = 0;

  try {
    for (const { path } of validCites) {
      if (attempts >= maxAttempts) {
        break;
      }
      if (deadline.signal.aborted) {
        opts.runtime?.log?.('[tlon] Cite resolution deadline reached');
        break;
      }

      const remainingMs = deadlineMs - (Date.now() - startedAt);
      if (remainingMs <= 0) {
        deadline.abort();
        opts.runtime?.log?.('[tlon] Cite resolution deadline reached');
        break;
      }

      attempts += 1;
      const signal = opts.signal
        ? AbortSignal.any([deadline.signal, opts.signal])
        : deadline.signal;

      try {
        const payload = await api.scry(path, {
          timeoutMs: remainingMs,
          signal,
        });
        throwIfAborted(opts.signal);
        if (deadline.signal.aborted) {
          break;
        }

        const parsedPayload = parsePostPayload(payload);
        if (!parsedPayload) {
          continue;
        }

        const text = renderHistoryContent(parsedPayload.entry);
        if (!text) {
          continue;
        }

        lines.push(
          `> ${parsedPayload.entry.author} wrote: ${sanitizeMessageText(text)}`
        );
      } catch (error) {
        if (opts.signal?.aborted) {
          throw error;
        }
        if (deadline.signal.aborted) {
          opts.runtime?.log?.(
            `[tlon] Cite resolution deadline reached: ${String(error)}`
          );
          break;
        }
        opts.runtime?.log?.(
          `[tlon] Failed to fetch cited post: ${String(error)}`
        );
        continue;
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return lines.join('\n');
}

export async function buildReplayMessageText(
  originalMessage: { messageText: string; messageContent?: unknown },
  api: CiteScryApi,
  opts: Pick<ResolveCitesOptions, 'runtime' | 'signal'> = {}
): Promise<{
  messageText: string;
  citedContent?: string;
  messageTextIsCiteFree: boolean;
}> {
  if (!isStory(originalMessage.messageContent)) {
    return {
      messageText: originalMessage.messageText,
      messageTextIsCiteFree: false,
    };
  }

  let rawText: string;
  try {
    rawText = extractMessageText(originalMessage.messageContent);
  } catch {
    return {
      messageText: originalMessage.messageText,
      messageTextIsCiteFree: false,
    };
  }
  const citedContent = await resolveCites(
    api,
    originalMessage.messageContent,
    opts
  );
  return {
    messageText: rawText,
    messageTextIsCiteFree: true,
    ...(citedContent ? { citedContent } : {}),
  };
}
