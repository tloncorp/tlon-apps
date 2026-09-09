// %notes replaces %diary. Existing diary channels stay readable and writable,
// but no new ones may be created (TLON-6480).
//
// 'notebook' is this codebase's name for the %diary channel type
// (`getChannelKindFromType('notebook') === 'diary'`); the %notes-backed type is
// 'notes'. The UI calls %diary 'Bulletin' and %notes 'Notebook'.

export const DIARY_CHANNEL_TYPE = 'notebook';

// Takes `unknown` because the channel-type unions in this codebase are spelled
// several ways (`db.ChannelType`, `Omit<db.ChannelType, 'dm' | 'groupDm'>`,
// screen-param string unions) and none of them widen to `string`.
export function isDiaryChannelType(
  type: unknown
): type is typeof DIARY_CHANNEL_TYPE {
  return type === DIARY_CHANNEL_TYPE;
}

// Shown wherever a diary creation is refused. Says what replaced it and that
// the existing channel is safe, since the refusal usually lands on someone who
// meant to duplicate a bulletin they still use.
export const DIARY_CREATION_BLOCKED_MESSAGE =
  'Bulletin channels can no longer be created. Create a notebook instead — ' +
  'existing bulletins keep working, and their posts can be migrated into one.';

// Thrown instead of a bare Error so a caller can tell a refusal apart from a
// backend failure and skip its error-reporting/rollback path.
export class DiaryCreationBlockedError extends Error {
  constructor() {
    super(DIARY_CREATION_BLOCKED_MESSAGE);
    this.name = 'DiaryCreationBlockedError';
  }
}
