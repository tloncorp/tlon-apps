// WebView accessibility may append one paragraph newline.
var next = Math.min(output.fixtureInput.index + 1, INPUT_TEXT.length);
output.fixtureInput = {
  index: next,
  pattern: '^' + INPUT_TEXT.slice(0, next) + '\\n?$',
};
