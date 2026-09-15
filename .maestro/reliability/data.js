function exact(value) {
  return '^' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
}
if (!/^~[a-z]+(?:-[a-z]+)*$/.test(MAESTRO_TEST_SHIP))
  throw new Error('Expected test ship is required');
if (!/^[A-Za-z0-9-]+$/.test(MAESTRO_RUN_TAG))
  throw new Error('A unique run tag is required');
output.reliability = {
  hosted: typeof MAESTRO_EMAIL !== 'undefined' && !!MAESTRO_EMAIL,
  session: typeof MAESTRO_SESSION === 'undefined' ? 'fresh' : MAESTRO_SESSION,
  group: 'QA-' + MAESTRO_RUN_TAG + '-' + JOURNEY,
  text: MAESTRO_RUN_TAG + ' message',
  editedText: MAESTRO_RUN_TAG + ' edited',
  reply: MAESTRO_RUN_TAG + ' reply',
  title: MAESTRO_RUN_TAG + ' note',
  body: MAESTRO_RUN_TAG + ' body',
  unreadChannelPreviewPattern: exact(
    '~ten: ' + MAESTRO_RUN_TAG + ' unread channel'
  ),
  unreadTopicPreviewPattern: exact(
    '~ten: ' + MAESTRO_RUN_TAG + ' unread topic'
  ),
  groupSwipePreviewPattern: exact(
    '~ten: ' + MAESTRO_RUN_TAG + ' group swipe unread'
  ),
  groupSwipeTitlePattern: exact('SwipeGroup-' + MAESTRO_RUN_TAG),
  dmSwipePreviewPattern: exact(MAESTRO_RUN_TAG + ' dm swipe unread'),
  activityMentionPattern:
    '^.*' + exact(MAESTRO_RUN_TAG + ' activity mention').slice(1, -1) + '.*$',
  activityMentionContextPattern: exact(
    '~zod ' + MAESTRO_RUN_TAG + ' activity mention'
  ),
  activityGroupPattern: exact('Activity-' + MAESTRO_RUN_TAG),
  activityReplyPattern:
    '^.*' + exact(MAESTRO_RUN_TAG + ' activity reply').slice(1, -1) + '.*$',
  // ContactName exposes a spoken label (zod / sampel - palnet) on native.
  // Accept that exact identity or its literal display, never a partial match.
  shipPattern:
    '^(' +
    MAESTRO_TEST_SHIP +
    '|' +
    MAESTRO_TEST_SHIP.slice(1).replace(/-/g, ' - ') +
    ')$',
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
if (output.reliability.session === 'fresh') {
  if (output.reliability.hosted) {
    if (typeof MAESTRO_PASSWORD === 'undefined' || !MAESTRO_PASSWORD)
      throw new Error('Fresh hosted setup requires a test account password');
  } else if (
    typeof MAESTRO_LOGIN_URL === 'undefined' ||
    !MAESTRO_LOGIN_URL ||
    typeof MAESTRO_LOGIN_CODE === 'undefined' ||
    !MAESTRO_LOGIN_CODE
  ) {
    throw new Error(
      'Fresh setup requires hosted credentials or a ship URL and access code'
    );
  }
}
