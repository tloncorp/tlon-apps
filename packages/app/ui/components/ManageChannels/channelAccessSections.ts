import type * as db from '@tloncorp/shared/db';
import { notesPermissionsCompatActive } from '@tloncorp/shared/logic/notesPermissionsCompat';

import type {
  SettingsRowModel,
  SettingsSectionModel,
} from '../SettingsList/types';
import { MEMBERS_MARKER } from './channelFormUtils';

interface Access {
  isPrivate: boolean;
  readers: string[];
  writers: string[];
}

/** How far a role reaches into a channel: nothing, seeing it, or posting. */
type Level = 0 | 1 | 2;

/**
 * A channel's permissions as one level per role, picked from a menu: no
 * access, can view, or can post. Posting includes seeing, so the two can't
 * disagree. Everyone in the group sets the floor, and a role can only be
 * raised above it, since a channel lists who may see and post, never who may
 * not. Notes channels share one permission, so they have two levels.
 */
export function channelAccessSections({
  groupRoles,
  channelType,
  isPrivate,
  readers,
  writers,
  onChange,
  onCreateRole,
}: Access & {
  groupRoles: db.GroupRole[];
  channelType?: string | null;
  onChange: (access: Access) => void;
  onCreateRole?: () => void;
}): SettingsSectionModel[] {
  const notes = notesPermissionsCompatActive(channelType ?? undefined);
  const levels: Level[] = notes ? [0, 2] : [0, 1, 2];
  const levelName = (level: Level) =>
    notes
      ? level === 2
        ? 'Can view and edit'
        : 'No access'
      : ['No access', 'Can view', 'Can post'][level];

  const roles = groupRoles
    .filter((role) => role.id && role.id !== 'admin')
    .map((role) => ({ id: role.id!, title: role.title ?? 'Unknown role' }));

  const floor: Level = !isPrivate
    ? 2
    : readers.includes(MEMBERS_MARKER)
      ? notes || writers.includes(MEMBERS_MARKER)
        ? 2
        : 1
      : 0;
  const ownLevel = (id: string): Level =>
    notes
      ? readers.includes(id)
        ? 2
        : 0
      : writers.includes(id)
        ? 2
        : readers.includes(id)
          ? 1
          : 0;
  const roleLevels = new Map(roles.map((role) => [role.id, ownLevel(role.id)]));

  const write = (nextFloor: Level, nextLevels: Map<string, Level>) => {
    if (nextFloor === 2) {
      onChange({ isPrivate: false, readers: [], writers: [] });
      return;
    }
    const above = (min: Level) =>
      roles
        .filter((role) => (nextLevels.get(role.id) ?? 0) >= min)
        .filter((role) => (nextLevels.get(role.id) ?? 0) > nextFloor)
        .map((role) => role.id);
    const nextReaders = [
      'admin',
      ...(nextFloor >= 1 ? [MEMBERS_MARKER] : []),
      ...above(1),
    ];
    onChange({
      isPrivate: true,
      readers: nextReaders,
      writers: notes ? nextReaders : ['admin', ...above(2)],
    });
  };

  const effective = (id: string) =>
    Math.max(floor, roleLevels.get(id) ?? 0) as Level;
  const who = (min: Level) => {
    if (floor >= min) return 'Everyone in the group';
    const names = [
      'Admin',
      ...roles.filter((role) => effective(role.id) >= min).map((r) => r.title),
    ];
    return names.length < 3
      ? names.join(' and ')
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  };
  const seers = who(1);
  const posters = who(2);
  const summary = notes
    ? `${floor === 2 ? posters : `Only ${posters}`} can see and edit this notebook.`
    : floor === 2
      ? 'Everyone in the group can see and post.'
      : seers === posters
        ? `Only ${posters} can see and post.`
        : `${seers} can see this channel. Only ${posters} can post.`;

  // A role's menu starts at what everyone has; picking that level hands the
  // role back to everyone's setting.
  const choices = levels.filter((level) => level >= floor);
  const roleRows: SettingsRowModel[] = roles.map((role) => {
    const level = effective(role.id);
    const subtitle =
      floor > 0 && (roleLevels.get(role.id) ?? 0) <= floor
        ? 'Same as everyone'
        : undefined;
    if (choices.length === 1) {
      return {
        key: role.id,
        title: role.title,
        subtitle,
        value: levelName(level),
        accessory: 'none',
        testID: `AccessLevel-${role.title}`,
      };
    }
    return {
      key: role.id,
      title: role.title,
      subtitle,
      picker: {
        value: String(level),
        options: choices.map((choice) => ({
          value: String(choice),
          title: levelName(choice),
        })),
        onChange: (value) => {
          const next = new Map(roleLevels);
          next.set(role.id, Number(value) as Level);
          write(floor, next);
        },
      },
      testID: `AccessLevel-${role.title}`,
    };
  });

  return [
    {
      key: 'access',
      footer: summary,
      rows: [
        {
          key: 'everyone',
          title: 'Everyone in the group',
          picker: {
            value: String(floor),
            options: levels.map((level) => ({
              value: String(level),
              title: levelName(level),
            })),
            onChange: (value) => write(Number(value) as Level, roleLevels),
          },
          testID: 'AccessLevel-Everyone',
        },
        {
          key: 'admin',
          title: 'Admin',
          subtitle: 'Always',
          value: levelName(2),
          accessory: 'none',
          testID: 'AccessLevel-Admin',
        },
        ...roleRows,
        ...(onCreateRole
          ? [
              {
                key: 'new-role',
                title: 'New role…',
                action: true,
                onPress: onCreateRole,
                testID: 'ChannelPermissionsNewRole',
              },
            ]
          : []),
      ],
    },
  ];
}
