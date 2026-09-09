function exact(value) {
  return '^' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
}
if (!/^~[a-z]+(?:-[a-z]+)*$/.test(MAESTRO_TEST_SHIP))
  throw new Error('Expected test ship is required');
if (!/^[A-Za-z0-9-]+$/.test(MAESTRO_RUN_TAG))
  throw new Error('A unique run tag is required');
output.reliability = {
  session: typeof MAESTRO_SESSION === 'undefined' ? 'fresh' : MAESTRO_SESSION,
  group: 'QA-' + MAESTRO_RUN_TAG + '-' + JOURNEY,
  text: MAESTRO_RUN_TAG + ' message',
  editedText: MAESTRO_RUN_TAG + ' edited',
  reply: MAESTRO_RUN_TAG + ' reply',
  title: MAESTRO_RUN_TAG + ' note',
  body: MAESTRO_RUN_TAG + ' body',
  shipPattern: exact(MAESTRO_TEST_SHIP),
};
output.reliability.groupPattern = exact(output.reliability.group);
output.reliability.editedTextPattern = exact(
  output.reliability.editedText
).replace(/\$$/, ' ?$');
output.reliability.textPattern = exact(output.reliability.text + ' ').replace(
  / \$$/,
  ' ?$'
);
output.reliability.replyPattern = exact(output.reliability.reply + ' ').replace(
  / \$$/,
  ' ?$'
);

if (
  output.reliability.session !== 'fresh' &&
  output.reliability.session !== 'warm'
)
  throw new Error('Use fresh or warm session');
if (
  output.reliability.session === 'fresh' &&
  (typeof MAESTRO_LOGIN_URL === 'undefined' ||
    typeof MAESTRO_LOGIN_CODE === 'undefined' ||
    !MAESTRO_LOGIN_URL ||
    !MAESTRO_LOGIN_CODE)
)
  throw new Error('Fresh setup requires a test ship URL and access code');
