import React from 'react';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { strToSym } from '@/logic/utils';
import { useForm } from 'react-hook-form';
import { GroupMeta } from '@/types/groups';
import { ChannelListItem } from './types';

interface HandleSectionNameEditInputProps {
  handleEditingChange: () => void;
  onSectionEditNameSubmit: (
    currentSectionKey: string,
    nextSectionTitle: string
  ) => void;
  sectionTitle: string;
  channels: ChannelListItem[];
  sectionKey: string;
}

export default function SectionNameEditInput({
  handleEditingChange,
  onSectionEditNameSubmit,
  channels,
  sectionTitle,
  sectionKey,
}: HandleSectionNameEditInputProps) {
  const group = useRouteGroup();

  const defaultValues: GroupMeta = {
    title: sectionTitle || '',
    description: '',
    image: '',
    color: '',
  };

  const untitledSectionValues: GroupMeta = {
    title: 'New Section',
    description: '',
    image: '',
    color: '',
  };

  const { handleSubmit, register } = useForm({
    defaultValues,
  });

  const addChannelsToZone = async (
    zone: string,
    groupFlag: string,
    channelFlag: string
  ) => {
    await useGroupState
      .getState()
      .addChannelToZone(zone, groupFlag, channelFlag);
  };

  const onSubmit = async (values: GroupMeta) => {
    const zoneFlag = sectionKey;
    handleEditingChange();
    await useGroupState.getState().createZone(group, zoneFlag, values);
    channels.forEach((channel) => {
      addChannelsToZone(zoneFlag, group, channel.key);
    });
    onSectionEditNameSubmit(zoneFlag, values.title);
  };

  const onLoseFocus = async () => {
    const zoneFlag = strToSym(sectionKey);
    handleEditingChange();
    if (sectionTitle && sectionTitle.length) {
      return;
    }
    await useGroupState
      .getState()
      .createZone(group, zoneFlag, untitledSectionValues);
    onSectionEditNameSubmit(zoneFlag, untitledSectionValues.title);
    channels.forEach((channel) => {
      addChannelsToZone(zoneFlag, group, channel.key);
    });
  };

  return (
    <form
      className="w-full"
      onSubmit={handleSubmit(onSubmit)}
      onBlur={handleSubmit(onLoseFocus)}
    >
      <input
        autoFocus
        {...register('title')}
        type="text"
        placeholder="New Section"
        className="input w-full border-gray-200 bg-transparent text-lg font-semibold focus:bg-transparent"
      />
    </form>
  );
}
