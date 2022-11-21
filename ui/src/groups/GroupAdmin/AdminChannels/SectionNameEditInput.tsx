import React, { useState } from 'react';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { strToSym } from '@/logic/utils';
import { useForm } from 'react-hook-form';
import { GroupMeta } from '@/types/groups';
import { ChannelListItem } from '@/groups/GroupAdmin/AdminChannels/types';
import { Status } from '@/logic/status';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

interface HandleSectionNameEditInputProps {
  handleEditingChange: () => void;
  onSectionEditNameSubmit: (
    currentSectionKey: string,
    nextSectionTitle: string
  ) => void;
  sectionTitle: string;
  isNew?: boolean;
  channels: ChannelListItem[];
  sectionKey: string;
  saveStatus: Status;
  setSaveStatus: (status: Status) => void;
}

export default function SectionNameEditInput({
  handleEditingChange,
  onSectionEditNameSubmit,
  channels,
  isNew,
  sectionTitle,
  sectionKey,
  saveStatus,
  setSaveStatus,
}: HandleSectionNameEditInputProps) {
  const group = useRouteGroup();

  const defaultValues: GroupMeta = {
    title: sectionTitle || '',
    description: '',
    image: '',
    cover: '',
  };

  const untitledSectionValues: GroupMeta = {
    title: 'New Section',
    description: '',
    image: '',
    cover: '',
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
    setSaveStatus('loading');
    const zoneFlag = strToSym(sectionKey);
    handleEditingChange();
    try {
      if (isNew === true) {
        await useGroupState.getState().createZone(group, zoneFlag, values);
        await useGroupState.getState().moveZone(group, zoneFlag, 1);
      } else {
        await useGroupState.getState().editZone(group, zoneFlag, values);
      }
      channels.forEach((channel) => {
        addChannelsToZone(zoneFlag, group, channel.key);
      });
      onSectionEditNameSubmit(zoneFlag, values.title);
      setSaveStatus('success');
    } catch (e) {
      setSaveStatus('error');
      console.log(e);
    }
  };

  const onLoseFocus = async () => {
    setSaveStatus('loading');
    const zoneFlag = strToSym(sectionKey);
    handleEditingChange();
    try {
      await useGroupState
        .getState()
        .createZone(group, zoneFlag, untitledSectionValues);
      await useGroupState.getState().moveZone(group, zoneFlag, 1);
      onSectionEditNameSubmit(zoneFlag, untitledSectionValues.title);
      channels.forEach((channel) => {
        addChannelsToZone(zoneFlag, group, channel.key);
      });
      setSaveStatus('success');
    } catch (e) {
      setSaveStatus('error');
      console.log(e);
    }
  };

  return (
    <form
      className="flex w-full items-center"
      onSubmit={handleSubmit(onSubmit)}
      onBlur={handleSubmit(onLoseFocus)}
    >
      <input
        autoFocus
        {...register('title')}
        type="text"
        placeholder="New Section"
        className="input alt-highlight w-full border-gray-200 bg-transparent text-lg font-semibold focus:bg-transparent"
      />
    </form>
  );
}
