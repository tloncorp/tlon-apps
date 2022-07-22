import React from 'react';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { strToSym } from '@/logic/utils';
import { useForm } from 'react-hook-form';
import { GroupMeta, Zones } from '@/types/groups';
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

interface SectionNameEditInputValues {
  zoneMeta: GroupMeta;
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

  const { handleSubmit, register, setValue, watch } = useForm({
    defaultValues,
  });

  const addChannelsToZone = async (
    zoneFlag: string,
    groupFlag: string,
    channelFlag: string
  ) => {
    await useGroupState
      .getState()
      .addChannelToZone(zoneFlag, groupFlag, channelFlag);
  };

  const onSubmit = async (values: GroupMeta) => {
    const zoneFlag = strToSym(sectionKey);
    onSectionEditNameSubmit(zoneFlag, values.title);
    handleEditingChange();
    await useGroupState.getState().createZone(group, zoneFlag, values);
    channels.forEach((channel) => {
      addChannelsToZone(zoneFlag, group, channel.key);
    });
  };

  return (
    <form className="w-full" onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('title')}
        type="text"
        placeholder="Section Name"
        className="input w-full border-gray-200 bg-transparent text-lg font-semibold focus:bg-transparent"
      />
    </form>
  );
}
