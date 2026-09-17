var forceIncremental =
  typeof INPUT_FORCE_INCREMENTAL !== 'undefined' &&
  (INPUT_FORCE_INCREMENTAL === true || INPUT_FORCE_INCREMENTAL === 'true');

output.fixtureInput = {
  index: 0,
  pattern: '^' + INPUT_TEXT + '\\n?$',
  forceIncremental: forceIncremental,
};
