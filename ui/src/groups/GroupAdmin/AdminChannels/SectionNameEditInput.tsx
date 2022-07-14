import React from 'react';
import { Channel } from '@/types/groups';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { useForm } from 'react-hook-form';
import { ChannelListItem } from './types';

interface HandleSectionNameEditInputProps {
  handleEditingChange: () => void;
  onSectionEditNameSubmit: (
    currentSectionKey: string,
    nextSectionTitle: string
  ) => void;
  channels: ChannelListItem[];
  sectionKey: string;
}

interface SectionNameEditInputValues {
  zone: string;
}

export default function SectionNameEditInput({
  handleEditingChange,
  onSectionEditNameSubmit,
  channels,
  sectionKey,
}: HandleSectionNameEditInputProps) {
  const groupFlag = useRouteGroup();

  const defaultValues: SectionNameEditInputValues = {
    zone: channels[0]?.channel.zone || '',
  };

  const { handleSubmit, register, setValue, watch } = useForm({
    defaultValues,
  });

  const onSubmit = async (values: SectionNameEditInputValues) => {
    onSectionEditNameSubmit(sectionKey, values.zone);
    handleEditingChange();
    await channels.forEach((channel) => {
      useGroupState
        .getState()
        .addChannelToZone(values.zone, groupFlag, channel.key);
    });
  };

  return (
    <form className="w-full" onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('zone')}
        type="text"
        placeholder="Section Name"
        className="input w-full border-gray-200 bg-transparent text-lg font-semibold focus:bg-transparent"
      />
    </form>
  );
}
