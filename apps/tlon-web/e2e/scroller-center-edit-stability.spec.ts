import { centerEditTitle } from '../../../scripts/scroll-stability-center-edit-evidence.mjs';
import { runCenterEditScenario } from './helpers/scrollerCenterEditScenario';
import { testWithOptions } from './test-fixtures';

const test = testWithOptions({
  appReadyTimeoutMs: 60_000,
  e2eMode: false,
  createdGroupCleanup: true,
});
test.use({ actionTimeout: 10_000 });

test(centerEditTitle, async ({ zodPage: page, browser }, testInfo) => {
  test.setTimeout(180_000);
  await runCenterEditScenario(page, browser, testInfo);
});
