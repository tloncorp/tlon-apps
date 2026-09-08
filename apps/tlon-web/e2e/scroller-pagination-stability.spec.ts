import { paginationTitle } from '../../../scripts/scroll-stability-pagination-evidence.mjs';
import { runPaginationScenario } from './helpers/scrollerPaginationScenario';
import { testWithOptions } from './test-fixtures';

const test = testWithOptions({
  appReadyTimeoutMs: 60_000,
  e2eMode: false,
  createdGroupCleanup: true,
});
test.use({ actionTimeout: 10_000 });
test(paginationTitle, async ({ zodPage, browser }, testInfo) => {
  test.setTimeout(180_000);
  await runPaginationScenario(zodPage, browser, testInfo);
});
