import { testWithOptions } from './test-fixtures';
import {
  seededSessionDefaults,
  seededSessionTitle,
} from '../../../packages/app/fixtures/scrollSeededSession';
import { runSeededSession } from './helpers/scrollerSeededSession';

const test = testWithOptions({
  appReadyTimeoutMs: 60000,
  e2eMode: false,
  createdGroupCleanup: true,
});
test(seededSessionTitle, async ({ zodPage, tenPage, browser }, testInfo) => {
  // Setup and exact-ID cleanup are outside the fixed 120-second measured window.
  test.setTimeout(300000);
  await runSeededSession(
    zodPage,
    tenPage,
    browser,
    testInfo,
    Number(process.env.SCROLLER_SEED ?? seededSessionDefaults.seed),
    Number(
      process.env.SCROLLER_ACTION_COUNT ?? seededSessionDefaults.actionCount
    )
  );
});
