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
  // Cloud retries reuse env values; each attempt still needs its own fixture.
  group:
    'QA-' + MAESTRO_RUN_TAG + '-' + JOURNEY + '-' + Date.now().toString(36),
  text: MAESTRO_RUN_TAG + ' message',
  editedText: MAESTRO_RUN_TAG + ' edited',
  reply: MAESTRO_RUN_TAG + ' reply',
  sibling: MAESTRO_RUN_TAG + ' sibling',
  title: MAESTRO_RUN_TAG + ' note',
  body: MAESTRO_RUN_TAG + ' body',
  linkUrl: 'https://tlon.io',
  // ContactName exposes a spoken label (zod / sampel - palnet) on native.
  // Accept that exact identity or its literal display, never a partial match.
  shipPattern:
    '^(' +
    MAESTRO_TEST_SHIP +
    '|' +
    MAESTRO_TEST_SHIP.slice(1).replace(/-/g, ' - ') +
    ')$',
};
// Native group titles are capped at 24 characters. This lifecycle creates and
// deletes its own exact fixture, so a short run-tagged name remains isolated.
if (JOURNEY === 'notebookchannel') {
  output.reliability.group = 'QA-' + MAESTRO_RUN_TAG + '-notebook';
}
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
output.reliability.siblingPattern = exact(output.reliability.sibling).replace(
  /\$$/,
  ' ?$'
);
output.reliability.folderParent = MAESTRO_RUN_TAG + '-sourceqzx';
output.reliability.folderParentQuery = 'sourceqzx';
output.reliability.folderChild = MAESTRO_RUN_TAG + '-movingkappa';
output.reliability.folderChildQuery = 'movingkappa';
output.reliability.folderLeaf = MAESTRO_RUN_TAG + '-descendantomega';
output.reliability.folderLeafQuery = 'descendantomega';
output.reliability.folderArchive = MAESTRO_RUN_TAG + '-targetarchive';
output.reliability.folderArchiveQuery = 'targetarchive';
output.reliability.folderDelete = MAESTRO_RUN_TAG + '-delete-me';
output.reliability.noteMove = MAESTRO_RUN_TAG + '-move-note';
output.reliability.noteMoveBody = MAESTRO_RUN_TAG + '-move-body';
output.reliability.noteDelete = MAESTRO_RUN_TAG + '-delete-note';
output.reliability.noteDeleteBody = MAESTRO_RUN_TAG + '-delete-body';
output.reliability.noteKeeper = MAESTRO_RUN_TAG + '-keep-note';
output.reliability.noteKeeperBody = MAESTRO_RUN_TAG + '-keep-body';
output.reliability.folderParentRowId =
  'NotesFolderRow-' + output.reliability.folderParent;
output.reliability.folderChildRowId =
  'NotesFolderRow-' + output.reliability.folderChild;
output.reliability.folderLeafRowId =
  'NotesFolderRow-' + output.reliability.folderLeaf;
output.reliability.folderArchiveRowId =
  'NotesFolderRow-' + output.reliability.folderArchive;
output.reliability.folderDeleteRowId =
  'NotesFolderRow-' + output.reliability.folderDelete;
output.reliability.folderParentTargetPattern = exact(
  'Create in ' + output.reliability.folderParent + '.'
);
output.reliability.folderChildTargetPattern = exact(
  'Create in ' +
    output.reliability.folderParent +
    ' / ' +
    output.reliability.folderChild +
    '.'
);
output.reliability.folderDeleteMessagePattern = exact(
  'Delete "' +
    output.reliability.folderDelete +
    '"? This folder will be permanently deleted.'
);
output.reliability.folderTreeDeleteMessagePattern = exact(
  'Delete "' +
    output.reliability.folderArchive +
    '"? This will permanently delete 1 note and 2 folders inside this folder.'
);
output.reliability.folderMoveActionPattern = exact(
  'Move to ' + output.reliability.folderArchive
);
output.reliability.folderMoveToastPattern = exact(
  'Moved folder to ' + output.reliability.folderArchive
);
output.reliability.noteMoveActionPattern = exact(
  'Move to ' + output.reliability.folderArchive
);
output.reliability.noteMoveToastPattern = exact(
  'Moved note to ' + output.reliability.folderArchive
);
output.reliability.noteDeleteMessagePattern = exact(
  'Delete "' +
    output.reliability.noteDelete +
    '"? This note will be removed from the notebook.'
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
