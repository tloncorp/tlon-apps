export function selectCases(selection) {
  const names = [
    'exchange',
    'invitations',
    'direct-messages',
    'moderation',
    'group-changes',
    'reactions',
    'contact-status',
    'group-mark-read',
    'channel-mark-read',
    'activity-filters',
    'permissions',
  ];
  const optionalNames = [
    'dm-deny',
    'dm-block',
    'dm-unblock',
    'blocked-group-invite',
    'blocked-group-content',
    'member-ban',
    'invite-revocation',
    'group-leave',
    'home-unread-preview',
    'group-swipe-read',
    'dm-swipe-read',
    'dm-copy-message',
    'dm-history-pagination',
    'activity-pagination',
    'global-notification-preferences',
    'permissions-restore',
    'member-invitation-filter',
    'gallery-actions',
  ];
  const requested =
    selection === 'all' ? names : (selection || 'exchange').split(',');
  if (
    !requested.length ||
    requested.some((name) => ![...names, ...optionalNames].includes(name))
  )
    throw Error('Unknown proof case');
  if (new Set(requested).size !== requested.length)
    throw Error('Duplicate proof case');
  const readCaseOrder = [
    'group-swipe-read',
    'group-mark-read',
    'channel-mark-read',
    'dm-swipe-read',
    'home-unread-preview',
    'activity-filters',
  ];
  const firstReadIndex = requested.findIndex((name) =>
    readCaseOrder.includes(name)
  );
  const selected =
    firstReadIndex < 0
      ? requested
      : [
          ...requested.slice(0, firstReadIndex),
          ...readCaseOrder.filter((name) => requested.includes(name)),
          ...requested
            .slice(firstReadIndex)
            .filter((name) => !readCaseOrder.includes(name)),
        ];
  if (
    selected.filter((name) =>
      [
        'direct-messages',
        'dm-deny',
        'dm-block',
        'dm-unblock',
        'blocked-group-invite',
        'blocked-group-content',
        'home-unread-preview',
        'dm-swipe-read',
        'dm-copy-message',
        'dm-history-pagination',
      ].includes(name)
    ).length > 1
  )
    throw Error('Run DM cases separately');
  if (
    selected.length > 1 &&
    selected.some((name) =>
      [
        'dm-block',
        'dm-unblock',
        'blocked-group-invite',
        'blocked-group-content',
      ].includes(name)
    )
  )
    throw Error('Run relationship-state cases separately');
  if (
    selected.includes('activity-filters') &&
    selected.includes('activity-pagination')
  )
    throw Error('Run Activity filters and pagination separately');
  return selected;
}
