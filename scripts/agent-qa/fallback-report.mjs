export function fallbackReport(report, pendingReview) {
  if (!pendingReview) return report;
  return [
    '**Review incomplete. No operator conclusion below has been independently verified.**',
    '',
    'The recording was captured, but independent review or publication did not finish. Checks and possible findings remain unverified.',
    '',
    '<details>',
    '<summary>Unreviewed operator observations</summary>',
    '',
    report,
    '',
    '</details>',
  ].join('\n');
}
