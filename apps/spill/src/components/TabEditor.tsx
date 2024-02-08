import {ToggleButton} from '@components/ToggleButton';
import {ToggleGroup} from '@components/ToggleGroup';
import * as db from '@db';
import {Button, Field, XStack, YStack} from '@ochre';
import React, {useCallback} from 'react';
import {IconInput} from './IconInput';
import {ChannelPicker, GroupPicker} from './ModelPicker';

export function TabEditor({
  value,
  onChange,
  onPressDelete,
}: {
  value: db.TabSettings;
  onPressDelete: () => void;
  onChange: (newValue: db.TabSettings) => void;
}) {
  const handleGroupingChange = useCallback(
    (newGrouping: db.StreamGroupBy) => {
      onChange({
        ...value,
        query: {
          ...value.query,
          groupBy: newGrouping,
        },
      });
    },
    [onChange, value],
  );

  const handleQuerySettingsChanged = useCallback(
    (settings: db.StreamQuerySettings) => {
      onChange({
        ...value,
        query: {
          ...value.query,
          ...settings,
        },
      });
    },
    [value, onChange],
  );

  const handleInterfaceSettingsChanged = useCallback(
    (settings: db.StreamViewSettings) => {
      onChange({
        ...value,
        view: {...value.view, ...settings},
      });
    },
    [value, onChange],
  );

  const handleChannelsChanged = useCallback(
    (newChannels: db.Channel[]) => {
      onChange({
        ...value,
        query: {
          ...value.query,
          inChannels: newChannels,
        },
      });
    },
    [onChange, value],
  );

  const handleGroupsChanged = useCallback(
    (newGroups: db.Group[]) => {
      onChange({
        ...value,
        query: {
          ...value.query,
          inGroups: newGroups,
        },
      });
    },
    [onChange, value],
  );

  const handleIconChanged = useCallback(
    (icon: db.TabIcon) => {
      onChange({...value, icon});
    },
    [onChange, value],
  );

  return (
    <YStack
      alignItems={'flex-start'}
      flex={1}
      gap={'$l'}
      borderLeftWidth={1}
      borderColor={'$color'}
      paddingTop="$l"
      paddingHorizontal="$m">
      <Field>
        <Field.Label>Icon</Field.Label>
        <Field.Input>
          <IconInput value={value.icon} onChange={handleIconChanged} />
        </Field.Input>
      </Field>
      <Field>
        <Field.Label>Type</Field.Label>
        <Field.Input>
          <GroupingEditor
            onChange={handleGroupingChange}
            value={value.query?.groupBy ?? 'post'}
          />
        </Field.Input>
      </Field>
      <Field>
        <Field.Label>Post Types</Field.Label>
        <Field.Input>
          <StreamQuerySettingsEditor
            value={value.query}
            onChange={handleQuerySettingsChanged}
          />
        </Field.Input>
      </Field>
      <Field>
        <Field.Label>Groups</Field.Label>
        <Field.Input>
          <GroupPicker
            value={value.query?.inGroups}
            onChange={handleGroupsChanged}
          />
        </Field.Input>
      </Field>
      <Field>
        <Field.Label>Channels</Field.Label>
        <Field.Input>
          <ChannelPicker
            value={value.query?.inChannels}
            onChange={handleChannelsChanged}
          />
        </Field.Input>
      </Field>
      <Field>
        <Field.Label>Interface Elements</Field.Label>
        <Field.Input>
          <StreamViewSettingsEditor
            value={value.view ?? {}}
            onChange={handleInterfaceSettingsChanged}
          />
        </Field.Input>
      </Field>
      <YStack padding="$s">
        <Button
          justifyContent="center"
          backgroundColor={'$red'}
          borderColor="$red"
          onPress={onPressDelete}>
          <Button.Text textAlign="center" color="$background">
            Delete
          </Button.Text>
        </Button>
      </YStack>
    </YStack>
  );
}

const groupingOptions = [
  {
    value: 'channel',
    label: 'Channel',
  },
  {
    value: 'group',
    label: 'Group',
  },
  {
    value: 'post',
    label: 'Post',
  },
];

function GroupingEditor({
  value,
  onChange,
}: {
  value: db.StreamGroupBy;
  onChange: (newValue: db.StreamGroupBy) => void;
}) {
  return (
    <ToggleGroup items={groupingOptions} value={value} onChange={onChange} />
  );
}

function StreamQuerySettingsEditor({
  value,
  onChange,
}: {
  value?: db.StreamQuerySettings | null;
  onChange: (filters: db.StreamQuerySettings) => void;
}) {
  const handlePressTypeOption = useCallback(
    (newValue: db.StreamPostType) => {
      onChange({
        ...value,
        ofType: newValue ? [newValue] : undefined,
      });
    },
    [onChange, value],
  );
  return (
    <StreamContentTypeEditor
      value={value?.ofType ?? null}
      onChange={handlePressTypeOption}
    />
  );
}

const contentTypeFilterOptions: {
  label: string;
  value: db.StreamPostType | 'all';
}[] = [
  {
    value: 'chat',
    label: 'Chat',
  },
  {
    value: 'diary',
    label: 'Diary',
  },
  {
    value: 'heap',
    label: 'Heap',
  },
  {
    value: 'all',
    label: 'All',
  },
];

function StreamContentTypeEditor({
  value,
  onChange,
}: {
  value: db.StreamPostType[] | null;
  onChange: (newValue: db.StreamPostType | null) => void;
}) {
  const handleChange = useCallback(
    (newValue: db.StreamPostType | 'all') => {
      onChange?.(newValue === 'all' ? null : newValue);
    },
    [onChange],
  );
  return (
    <ToggleGroup
      items={contentTypeFilterOptions}
      value={value?.[0] ?? 'all'}
      onChange={handleChange}
    />
  );
}

const streamViewSettingToggles: {
  value: db.StreamViewSettingsKey;
  label: string;
}[] = [
  {value: 'showAuthor', label: 'Author'},
  {value: 'showContent', label: 'Content'},
  {value: 'showTime', label: 'Time'},
  {value: 'showChannel', label: 'Channel'},
  {value: 'showGroup', label: 'Group'},
  {value: 'showReplyCount', label: 'ReplyCount'},
];

export function StreamViewSettingsEditor({
  value,
  onChange,
}: {
  value: db.StreamViewSettings;
  onChange: (settings: db.StreamViewSettings) => void;
}) {
  const handleChange = useCallback(
    <K extends db.StreamViewSettingsKey>(
      target: K,
      newValue: db.StreamViewSettings[K],
    ) => {
      onChange({
        ...value,
        [target]: newValue,
      });
    },
    [onChange, value],
  );

  return (
    <XStack flexWrap="wrap" gap="$s" justifyContent="flex-start">
      {streamViewSettingToggles.map(toggle => {
        return (
          <StreamViewSettingToggle
            key={toggle.value}
            value={value[toggle.value] ?? true}
            target={toggle.value}
            label={toggle.label}
            onChange={handleChange}
          />
        );
      })}
    </XStack>
  );
}

export function StreamViewSettingToggle({
  label,
  target,
  value,
  onChange,
}: {
  target: db.StreamViewSettingsKey;
  value: boolean;
  label: string;
  onChange: (target: db.StreamViewSettingsKey, value: boolean) => void;
}) {
  const handlePress = useCallback(() => {
    onChange(target, !value);
  }, [onChange, target, value]);
  return (
    <ToggleButton active={value} onPress={handlePress}>
      <ToggleButton.Text>{label}</ToggleButton.Text>
    </ToggleButton>
  );
}
