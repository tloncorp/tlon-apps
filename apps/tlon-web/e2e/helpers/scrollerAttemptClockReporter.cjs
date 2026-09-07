/** Playwright duration is timeout-budget elapsed, not the attempt's wall span. */
class ScrollerAttemptClockReporter {
  onTestEnd(test, result) {
    result.annotations.push({
      type: 'scroller-attempt-clock',
      description: JSON.stringify({
        version: 1,
        source: 'playwright.onTestEnd',
        testId: test.id,
        retry: result.retry,
        startTime: result.startTime.toISOString(),
        endedAt: Date.now(),
      }),
    });
  }
}

/** Only the enclosing result supplies this clock; content proofs cannot. */
function readAttemptClock(attempt, testId) {
  if (attempt.annotations !== undefined && !Array.isArray(attempt.annotations))
    return { attemptClockError: 'Invalid enclosing Playwright annotations' };
  const matches = (attempt.annotations ?? []).filter(
    (item) => item?.type === 'scroller-attempt-clock'
  );
  if (!matches.length) return {};
  try {
    if (matches.length !== 1) throw new Error('Duplicate clock');
    const clock = JSON.parse(matches[0].description);
    const start = Date.parse(attempt.startTime);
    if (
      clock.version !== 1 ||
      clock.source !== 'playwright.onTestEnd' ||
      typeof testId !== 'string' ||
      !testId ||
      clock.testId !== testId ||
      !Number.isInteger(attempt.retry) ||
      clock.retry !== attempt.retry ||
      clock.startTime !== attempt.startTime ||
      !Number.isFinite(start) ||
      !Number.isFinite(clock.endedAt) ||
      !Number.isFinite(attempt.duration) ||
      attempt.duration < 0 ||
      clock.endedAt < start + attempt.duration
    )
      throw new Error('Mismatched clock');
    return { attemptWallEndTime: clock.endedAt };
  } catch {
    return {
      attemptClockError: 'Invalid enclosing Playwright wall-clock observation',
    };
  }
}

module.exports = ScrollerAttemptClockReporter;
module.exports.readAttemptClock = readAttemptClock;
