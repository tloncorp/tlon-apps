import React from 'react';
import {
  useGroupCreateZoneMutation,
  useGroupEditZoneMutation,
  useGroupMoveZoneMutation,
  useRouteGroup,
} from '@/state/groups';
import { strToSym } from '@/logic/utils';
import { useForm } from 'react-hook-form';
import { GroupMeta } from '@/types/groups';
import { ChannelListItem } from '@/groups/ChannelsList/types';
import { Status } from '@/logic/status';

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
  const { mutate: createZoneMutation } = useGroupCreateZoneMutation();
  const { mutate: moveZoneMutation } = useGroupMoveZoneMutation();
  const { mutate: editZoneMutation } = useGroupEditZoneMutation();

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

  const { handleSubmit, register, getValues } = useForm({
    defaultValues,
  });

  const onSubmit = async (values: GroupMeta) => {
    setSaveStatus('loading');
    const zoneFlag = strToSym(sectionKey);
    const titleExists = values.title.trim() !== '';
    handleEditingChange();
    try {
      if (isNew === true) {
        createZoneMutation({
          flag: group,
          zone: zoneFlag,
          meta: titleExists ? values : untitledSectionValues,
        });
        moveZoneMutation({
          flag: group,
          zone: zoneFlag,
          index: 1,
        });
      } else {
        editZoneMutation({
          flag: group,
          zone: zoneFlag,
          meta: titleExists ? values : untitledSectionValues,
        });
      }
      onSectionEditNameSubmit(
        zoneFlag,
        titleExists ? values.title : untitledSectionValues.title
      );
      setSaveStatus('success');
    } catch (e) {
      setSaveStatus('error');
      console.log(e);
    }
  };

  const onLoseFocus = async () => {
    const values = getValues();
    onSubmit(values);
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
