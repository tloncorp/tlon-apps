function exact(value) {
  return '^' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
}
if (!/^~[a-z]+(?:-[a-z]+)*$/.test(MAESTRO_TEST_SHIP))
  throw new Error('Expected test ship is required');
if (!/^[A-Za-z0-9-]+$/.test(MAESTRO_RUN_TAG))
  throw new Error('A unique run tag is required');
function shortHash(value) {
  var hash = 0;
  for (var index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).padStart(6, '0').slice(-6);
}
var groupAttempt = Date.now().toString(36).slice(-6);
var groupJourney = shortHash(JOURNEY);
var groupSuffix = '-' + groupJourney + '-' + groupAttempt;
var renamedGroupSuffix = ' renamed';
var maxGroupRunTagLength = Math.max(
  1,
  30 - 'QA-'.length - groupSuffix.length - renamedGroupSuffix.length
);

output.reliability = {
  hosted: typeof MAESTRO_EMAIL !== 'undefined' && !!MAESTRO_EMAIL,
  session: typeof MAESTRO_SESSION === 'undefined' ? 'fresh' : MAESTRO_SESSION,
  // Cloud retries reuse env values; each attempt still needs its own fixture.
  group: 'QA-' + MAESTRO_RUN_TAG.slice(0, maxGroupRunTagLength) + groupSuffix,
  groupQuery: groupJourney + '-' + groupAttempt,
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
output.reliability.noteRootOlder = MAESTRO_RUN_TAG + '-root-older';
output.reliability.noteRootOlderBody = MAESTRO_RUN_TAG + '-root-older-body';
output.reliability.noteRootNewer = MAESTRO_RUN_TAG + '-root-newer';
output.reliability.noteRootNewerBody = MAESTRO_RUN_TAG + '-root-newer-body';
output.reliability.noteRowTarget = MAESTRO_RUN_TAG + '-row-target';
output.reliability.noteRowTargetBody = MAESTRO_RUN_TAG + '-row-target-body';
output.reliability.noteViewedTarget = MAESTRO_RUN_TAG + '-view-target';
output.reliability.noteViewedTargetBody = MAESTRO_RUN_TAG + '-view-target-body';
output.reliability.notePreviewTitle = MAESTRO_RUN_TAG + '-preview-note';
output.reliability.noteTrimmedTitle = MAESTRO_RUN_TAG + '-trimmed-title';
output.reliability.noteSpacedTitle =
  '  ' + output.reliability.noteTrimmedTitle + '  ';
output.reliability.noteLongTitle =
  MAESTRO_RUN_TAG +
  '-a-deliberately-long-notebook-title-that-remains-usable-in-detail-row-and-actions';
output.reliability.noteLongTitlePattern = exact(
  output.reliability.noteLongTitle
);
output.reliability.noteTitleEdgeBody = MAESTRO_RUN_TAG + '-body-preserved';
output.reliability.markdownMalformed = '# Broken edge [';
output.reliability.markdownMalformedRendered = '^Broken edge \\[$';
output.reliability.markdownBody =
  '# Rendered heading\n\n' +
  '**Bold sample** and *italic sample*\n\n' +
  '- First item\n- Second item\n\n' +
  '`inline code`\n\n' +
  '[Example link](https://tlon.io)';
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
output.reliability.folderParentPathPattern = exact(
  'Root / ' + output.reliability.folderParent
);
output.reliability.noteDatePattern =
  '^(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{1,2}(st|nd|rd|th), 20[0-9]{2}$';
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
