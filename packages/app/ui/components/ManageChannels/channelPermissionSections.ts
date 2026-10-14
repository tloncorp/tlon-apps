import type * as db from '@tloncorp/shared/db';
import {
  NOTES_PERMISSIONS_COMPAT_NOTICE,
  notesPermissionsCompatActive,
} from '@tloncorp/shared/logic/notesPermissionsCompat';

import type {
  SettingsRowModel,
  SettingsSectionModel,
} from '../SettingsList/types';
import { MEMBERS_MARKER } from './channelFormUtils';

interface Permissions {
  readers: string[];
  writers: string[];
}

/**
 * A private channel's permissions as two checklists of the group's roles:
 * who can see the channel, and of those, who can post in it. Admins always
 * can do both. A channel with one shared permission, as notes channels have,
 * gets one checklist.
 */
export function channelPermissionSections({
  groupRoles,
  channelType,
  readers,
  writers,
  onChange,
  onCreateRole,
}: Permissions & {
  groupRoles: db.GroupRole[];
  channelType?: string | null;
  onChange: (permissions: Permissions) => void;
  onCreateRole?: () => void;
}): SettingsSectionModel[] {
  const roles = [
    { id: 'admin', title: 'Admin', subtitle: undefined },
    ...groupRoles
      .filter((role) => role.id && role.id !== 'admin')
      .map((role) => ({
        id: role.id!,
        title: role.title ?? 'Unknown role',
        subtitle: undefined,
      })),
    // Kept as "Members" so it reads the same as the old table's row.
    { id: MEMBERS_MARKER, title: 'Members', subtitle: 'Everyone in the group' },
  ];
  const without = (ids: string[], id: string) => ids.filter((x) => x !== id);
  const createRoleRows: SettingsRowModel[] = onCreateRole
    ? [
        {
          key: 'new-role',
          title: 'New role…',
          action: true,
          onPress: onCreateRole,
          testID: 'ChannelPermissionsNewRole',
        },
      ]
    : [];

  if (notesPermissionsCompatActive(channelType ?? undefined)) {
    return [
      {
        key: 'access',
        title: 'Who can see and post',
        footer: NOTES_PERMISSIONS_COMPAT_NOTICE,
        rows: [
          ...roles.map((role) => {
            const has = readers.includes(role.id);
            return {
              key: role.id,
              title: role.title,
              subtitle: role.subtitle,
              selected: role.id === 'admin' || has,
              multiple: true,
              disabled: role.id === 'admin',
              onPress: () =>
                onChange(
                  has
                    ? {
                        readers: without(readers, role.id),
                        writers: without(writers, role.id),
                      }
                    : {
                        readers: [...readers, role.id],
                        writers: [...writers, role.id],
                      }
                ),
              testID: `ReadToggle-${role.title}`,
            };
          }),
          ...createRoleRows,
        ],
      },
    ];
  }

  return [
    {
      key: 'readers',
      title: 'Who can see it',
      rows: [
        ...roles.map((role) => {
          const canRead = readers.includes(role.id);
          return {
            key: role.id,
            title: role.title,
            subtitle: role.subtitle,
            selected: role.id === 'admin' || canRead,
            multiple: true,
            disabled: role.id === 'admin',
            // No read means no write.
            onPress: () =>
              onChange(
                canRead
                  ? {
                      readers: without(readers, role.id),
                      writers: without(writers, role.id),
                    }
                  : { readers: [...readers, role.id], writers }
              ),
            testID: `ReadToggle-${role.title}`,
          };
        }),
        ...createRoleRows,
      ],
    },
    {
      key: 'writers',
      title: 'Who can post',
      footer: 'Only roles that can see the channel can post in it.',
      rows: roles
        .filter((role) => role.id === 'admin' || readers.includes(role.id))
        .map((role) => {
          const canWrite = writers.includes(role.id);
          return {
            key: role.id,
            title: role.title,
            subtitle: role.subtitle,
            selected: role.id === 'admin' || canWrite,
            multiple: true,
            disabled: role.id === 'admin',
            onPress: () =>
              onChange({
                readers,
                writers: canWrite
                  ? without(writers, role.id)
                  : [...writers, role.id],
              }),
            testID: `WriteToggle-${role.title}`,
          };
        }),
    },
  ];
}
