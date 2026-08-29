import type { BrowserContext } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  HOST_CSP_VIOLATION_GLOBAL,
  type HostCspViolationSnapshot,
} from '../src/logic/hostCspViolations';

/**
 * GATE B COLLECTOR — the Report-Only evidence run.
 *
 * hostCsp.ts refuses to enforce without "a clean Report-Only run first",
 * because under an enforcing `<meta>` there is no `report-uri` and an
 * origin missing from FRAME_SRC_SOURCES becomes a silently broken
 * feature rather than a report. The dev and preview servers are the only
 * places Report-Only can be delivered at all, and this suite is the only
 * thing that drives the real app across them at scale — so this suite IS
 * the run.
 *
 * Every ship fixture drains the in-page collector before closing its
 * context, so a violation anywhere in the suite lands in one file
 * instead of scrolling past in a browser console nobody was reading.
 *
 * KNOWN LIMIT, stated so a clean file is not over-read: the collector
 * lives in the page, so a full document navigation resets it and only
 * the last document of a test is drained. The suite navigates once per
 * fixture and then drives the SPA, so in practice that is the whole
 * test — but a violation on a page that was later reloaded away would
 * not appear here.
 */

const LOG_PATH = join(
  __dirname,
  '..',
  'test-results',
  'host-csp-violations.jsonl'
);

type DrainEntry =
  | ({ label: string; url: string } & HostCspViolationSnapshot)
  | { label: string; url: string; error: string };

function append(entry: DrainEntry) {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
}

/**
 * Reads the collector out of every page in the context. A page that
 * cannot be read is recorded as such rather than skipped: "no violations
 * seen" has to mean the pages were looked at, not that looking failed.
 */
export async function drainHostCspViolations(
  context: BrowserContext,
  label: string
) {
  for (const page of context.pages()) {
    if (page.isClosed()) {
      continue;
    }
    let snapshot: HostCspViolationSnapshot | null;
    const url = page.url();
    try {
      snapshot = await page.evaluate((key) => {
        const collector = (
          window as unknown as Record<
            string,
            { snapshot: () => HostCspViolationSnapshot } | undefined
          >
        )[key];
        return collector ? collector.snapshot() : null;
      }, HOST_CSP_VIOLATION_GLOBAL);
    } catch (error) {
      append({ label, url, error: (error as Error).message });
      continue;
    }

    if (!snapshot) {
      // the listener is installed by main.tsx before the app mounts, so
      // its absence means the page was never the app — not that the app
      // was clean
      append({ label, url, error: 'no host CSP collector on page' });
      continue;
    }

    // EVERY drained page is recorded, including the clean ones. An empty
    // log cannot distinguish "nothing violated" from "nothing was ever
    // looked at", and the whole point of this file is to make the clean
    // result a claim someone can count rather than an absence.
    append({ label, url, ...snapshot });

    if (snapshot.emitted > 0) {
      // loud in the runner output: a violation here is a finding about
      // FRAME_SRC_SOURCES, not a test failure to be scrolled past
      console.warn(
        `[host-csp] ${label}: ${snapshot.emitted} violation(s), ${snapshot.dropped} suppressed — ` +
          snapshot.records
            .map((r) => `${r.directive} ${r.blockedScheme}://${r.blockedHost}`)
            .join(', ')
      );
    }
  }
}
