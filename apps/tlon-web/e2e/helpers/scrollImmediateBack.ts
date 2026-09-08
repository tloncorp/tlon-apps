import type { Locator, Page } from '@playwright/test';

type Capture = {
  begin(id: string): Promise<unknown>;
  end(id: string): Promise<unknown>;
};
type Outcome = { ok: true } | { ok: false; error: unknown };
const outcome = (work: Promise<unknown>): Promise<Outcome> =>
  work.then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error })
  );

/** Observe the real route commit while the real click's acknowledgement is pending. */
export async function returnOnThreadRoute(
  page: Page,
  trigger: Locator,
  threadRoute: string,
  capture: Capture
) {
  // Arm before dispatch; neither row visibility nor click completion gates Back.
  const arriving = outcome(
    page.waitForURL((url) => url.pathname === threadRoute, {
      waitUntil: 'commit',
      timeout: 2000,
    })
  );
  const opening = outcome(
    Promise.resolve().then(() => trigger.click({ timeout: 10_000 }))
  );
  const errors: unknown[] = [];
  try {
    const ready = await Promise.race([
      arriving,
      opening.then((result) => (result.ok ? arriving : result)),
    ]);
    if (!ready.ok) throw ready.error;
    await capture.begin('return-channel');
    try {
      await page.goBack({ timeout: 3000 });
    } finally {
      await capture.end('return-channel');
    }
  } catch (error) {
    errors.push(error);
  }
  // Keep late click/hit-target failures and its original bracket in the trace.
  const opened = await opening;
  if (!opened.ok && !errors.includes(opened.error)) errors.push(opened.error);
  try {
    await capture.end('open-thread');
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, 'Navigation actions failed');
}
