import type * as db from '@tloncorp/shared/db';
import { describe, expect, it, vi } from 'vitest';

import type { SettingsRowModel } from '../SettingsList/types';
import {
  type ChannelAccess,
  channelAccessSections,
  withCreatedRole,
} from './channelAccessSections';
import { MEMBERS_MARKER } from './channelFormUtils';

const roles = [
  { id: 'admin', title: 'Admin' },
  { id: 'gardeners', title: 'Gardeners' },
  { id: 'mods', title: 'Moderators' },
] as db.GroupRole[];

function render(access: ChannelAccess, channelType = 'chat') {
  const onChange = vi.fn();
  const sections = channelAccessSections({
    groupRoles: roles,
    channelType,
    ...access,
    onChange,
  });
  const rows = sections.flatMap((section) => section.rows);
  const row = (key: string) =>
    rows.find((r) => r.key === key) as SettingsRowModel;
  return { sections, row, onChange };
}

const open: ChannelAccess = { isPrivate: false, readers: [], writers: [] };

describe('channelAccessSections', () => {
  it('lets everyone post on an open channel, with no choice left for roles', () => {
    const { sections, row } = render(open);
    expect(row('everyone').picker?.value).toBe('2');
    expect(row('gardeners').picker).toBeUndefined();
    expect(row('gardeners').value).toBe('Can post');
    expect(sections[1].footer).toBe('Everyone can see and post.');
    expect(row('admin')).toBeUndefined();
  });

  it('turns everyone viewing into members reading and only admins writing', () => {
    const { row, onChange } = render(open);
    row('everyone').picker!.onChange('1');
    expect(onChange).toHaveBeenCalledWith({
      isPrivate: true,
      readers: ['admin', MEMBERS_MARKER],
      writers: ['admin'],
    });
  });

  it('reads an announcements channel back as levels', () => {
    const { sections, row } = render({
      isPrivate: true,
      readers: ['admin', MEMBERS_MARKER],
      writers: ['admin', 'mods'],
    });
    expect(row('everyone').picker?.value).toBe('1');
    expect(row('mods').picker?.value).toBe('2');
    expect(row('gardeners').picker?.value).toBe('1');
    expect(row('gardeners').subtitle).toBe('Same as everyone');
    expect(row('gardeners').picker?.options.map((o) => o.title)).toEqual([
      'Can view',
      'Can post',
    ]);
    expect(sections[1].footer).toBe(
      'Everyone can see this channel. Only admins and Moderators can post.'
    );
  });

  it('gives a role its own access only above what everyone has', () => {
    const { row, onChange } = render({
      isPrivate: true,
      readers: ['admin'],
      writers: ['admin'],
    });
    row('gardeners').picker!.onChange('1');
    expect(onChange).toHaveBeenLastCalledWith({
      isPrivate: true,
      readers: ['admin', 'gardeners'],
      writers: ['admin'],
    });
  });

  it('keeps a notebook to two levels, with readers and writers alike', () => {
    const { row, onChange, sections } = render(
      { isPrivate: true, readers: ['admin'], writers: ['admin'] },
      'notes'
    );
    expect(row('everyone').picker?.options.map((o) => o.title)).toEqual([
      'No access',
      'Can view and edit',
    ]);
    row('gardeners').picker!.onChange('2');
    expect(onChange).toHaveBeenLastCalledWith({
      isPrivate: true,
      readers: ['admin', 'gardeners'],
      writers: ['admin', 'gardeners'],
    });
    expect(sections[1].footer).toBe(
      'Only admins can see and edit this notebook.'
    );
  });

  // An empty list of who may post arrives as MEMBERS_MARKER: anyone who can
  // see the channel may post.
  it('lets a role that sees the channel post when posting is open to everyone who sees it', () => {
    const { sections, row, onChange } = render({
      isPrivate: true,
      readers: ['admin', 'gardeners'],
      writers: ['admin', MEMBERS_MARKER],
    });
    expect(row('gardeners').picker?.value).toBe('2');
    expect(sections[1].footer).toBe(
      'Only admins and Gardeners can see and post.'
    );
    row('mods').picker!.onChange('1');
    expect(onChange).toHaveBeenLastCalledWith({
      isPrivate: true,
      readers: ['admin', 'gardeners', 'mods'],
      writers: ['admin', 'gardeners'],
    });
  });

  it('takes away what roles only had through everyone when everyone is lowered', () => {
    const { row, onChange } = render({
      isPrivate: true,
      readers: ['admin', MEMBERS_MARKER, 'mods'],
      writers: ['admin'],
    });
    expect(row('gardeners').subtitle).toBe('Same as everyone');
    row('everyone').picker!.onChange('0');
    expect(onChange).toHaveBeenLastCalledWith({
      isPrivate: true,
      readers: ['admin', 'mods'],
      writers: ['admin'],
    });
  });

  it('lists three or more who can see or post with commas', () => {
    const { sections } = render({
      isPrivate: true,
      readers: ['admin', 'gardeners', 'mods'],
      writers: ['admin', 'gardeners'],
    });
    expect(sections[1].footer).toBe(
      'Only admins, Gardeners and Moderators can see this channel. Only admins and Gardeners can post.'
    );
  });

  it('gives no access to a role that may post but can’t see the channel', () => {
    const { sections, row, onChange } = render({
      isPrivate: true,
      readers: ['admin'],
      writers: ['admin', 'mods'],
    });
    expect(row('mods').picker?.value).toBe('0');
    expect(sections[1].footer).toBe('Only admins can see and post.');
    row('gardeners').picker!.onChange('1');
    expect(onChange).toHaveBeenLastCalledWith({
      isPrivate: true,
      readers: ['admin', 'gardeners'],
      writers: ['admin'],
    });
  });
});

describe('withCreatedRole', () => {
  it('leaves an open channel alone', () => {
    expect(withCreatedRole(open, 'new', 'chat')).toBe(open);
  });

  it('lets the role see a channel only admins see', () => {
    expect(
      withCreatedRole(
        { isPrivate: true, readers: ['admin'], writers: ['admin'] },
        'new',
        'chat'
      )
    ).toEqual({
      isPrivate: true,
      readers: ['admin', 'new'],
      writers: ['admin'],
    });
  });

  it('lets the role post in a channel everyone sees', () => {
    expect(
      withCreatedRole(
        {
          isPrivate: true,
          readers: ['admin', MEMBERS_MARKER],
          writers: ['admin'],
        },
        'new',
        'chat'
      )
    ).toEqual({
      isPrivate: true,
      readers: ['admin', MEMBERS_MARKER, 'new'],
      writers: ['admin', 'new'],
    });
  });
});
