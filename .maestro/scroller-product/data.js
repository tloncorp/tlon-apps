// Declared input and rendered plain-text corpus. No device or application APIs.
if (APP_ID !== 'io.tlon.groups.preview') {
  throw new Error('This journey requires the wrapper-verified preview app');
}
if (!/^[A-Za-z0-9-]+$/.test(RUN_TAG)) {
  throw new Error(
    'RUN_TAG must contain only ASCII letters, digits, and hyphens'
  );
}
if (!GROUP_NAME || GROUP_NAME.trim() !== GROUP_NAME) {
  throw new Error(
    'GROUP_NAME must be a nonempty explicit name without edge whitespace'
  );
}
if (
  typeof SCROLLER_OUTPUT_DIR !== 'string' ||
  !SCROLLER_OUTPUT_DIR.startsWith('/') ||
  /^\/+$/.test(SCROLLER_OUTPUT_DIR) ||
  SCROLLER_OUTPUT_DIR.trim() !== SCROLLER_OUTPUT_DIR
) {
  throw new Error(
    'SCROLLER_OUTPUT_DIR must be a nonempty absolute output directory'
  );
}
function exact(text) {
  return '^' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
}
function message(lines) {
  return {
    lines: lines,
    input: lines.join('\n'),
    inputPattern: exact(lines.join('\n')),
    paragraphPatterns: lines.map(function (line) {
      return exact(line + ' ');
    }),
    // Repeated endpoints cover the one/two-line cases; every declared line
    // occurs in this fixed-size selector for our bounded one-to-three-line corpus.
    scopePatterns: [0, Math.floor(lines.length / 2), lines.length - 1].map(
      function (i) {
        return exact(lines[i] + ' ');
      }
    ),
  };
}
var messages = [];
for (var index = 1; index <= 18; index++) {
  var number = index < 10 ? '0' + index : String(index);
  var prefix = RUN_TAG + ' message ' + number;
  var lines =
    index % 3 === 1
      ? [prefix + ' short.']
      : index % 3 === 2
        ? [
            prefix +
              ' This longer paragraph wraps across the native message width while keeping every original word in the sent content. The final sentence identifies the same message.',
          ]
        : [
            prefix + ' first line.',
            prefix + ' second line.',
            prefix + ' third line.',
          ];
  messages.push(message(lines));
}
output.scrollerProduct = {
  messages: messages,
  lastIndex: messages.length - 1,
  outputDir: SCROLLER_OUTPUT_DIR.replace(/\/+$/, ''),
  reply: message([
    RUN_TAG + ' thread reply first line.',
    RUN_TAG + ' thread reply second line.',
  ]),
  groupPattern: exact(GROUP_NAME),
  firstInputPattern: exact(messages[messages.length - 1].lines[0]),
  index: 0,
  current: messages[0],
};
