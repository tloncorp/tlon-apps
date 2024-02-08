import {
  ChannelListItemComponent,
  GroupListItemComponent,
} from '@components/ObjectListItem';
import {ChannelToken, GroupToken} from '@components/ObjectToken';
import * as db from '@db';
import {createPickerItem, ListPicker} from '@ochre/ListPicker';
import React from 'react';

// Channel

export function ChannelPicker({
  value,
  onChange,
}: {
  value?: db.Channel[];
  onChange?: (newValue: db.Channel[]) => void;
}) {
  return (
    <ListPicker
      getOptions={getChannelOptions}
      onChange={onChange}
      value={value}
      ItemComponent={ChannelPickerItem}
      PreviewComponent={ChannelToken}
    />
  );
}

const ChannelPickerItem = createPickerItem(ChannelListItemComponent);

const getChannelOptions = (searchQuery: string | null, ops: db.Operations) => {
  return ops.getObjects(
    'Channel',
    db.channelQuery({containsText: searchQuery ? searchQuery : null}),
  );
};

// Group

export function GroupPicker({
  value,
  onChange,
}: {
  value?: db.Group[] | null;
  onChange?: (newValue: db.Group[]) => void;
}) {
  return (
    <ListPicker
      getOptions={getGroupOptions}
      onChange={onChange}
      value={value ?? undefined}
      ItemComponent={GroupPickerItem}
      PreviewComponent={GroupToken}
    />
  );
}

const GroupPickerItem = createPickerItem(GroupListItemComponent);

const getGroupOptions = (searchQuery: string | null, ops: db.Operations) => {
  return ops.getObjects('Group', db.groupQuery({containsText: searchQuery}));
};
