import React, { useCallback, useEffect, useState } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import SixDotIcon from '@/components/icons/SixDotIcon';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { strToSym } from '@/logic/utils';
import { SectionListItem } from './types';
import Channels from './Channels';
import EditSectionDropdown from './EditSectionDropdown';
import SectionNameEditInput from './SectionNameEditInput';

interface SectionProps {
  sectionData: SectionListItem;
  sectionKey: string;
  index: number;
  onSectionEditNameSubmit: (
    currentSectionKey: string,
    nextSectionTitle: string
  ) => void;
  onSectionDelete: (currentSectionKey: string) => void;
  onChannelDelete: (channelFlag: string, sectionKey: string) => void;
}

export default function Section({
  sectionData,
  sectionKey,
  index,
  onSectionEditNameSubmit,
  onSectionDelete,
  onChannelDelete,
}: SectionProps) {
  const group = useRouteGroup();
  const [isEditing, setIsEditing] = useState(false);
  const isSectionless = sectionKey === 'sectionless';

  useEffect(() => {
    if (sectionData.isNew === true) {
      setIsEditing(true);
    }
  }, [sectionData.isNew]);

  const handleEditingChange = useCallback(() => {
    setIsEditing(!isEditing);
  }, [isEditing]);

  const removeChannelsFromZone = async (
    groupFlag: string,
    channelFlag: string
  ) => {
    await useGroupState
      .getState()
      .removeChannelFromZone(groupFlag, channelFlag);
  };

  const handleDeleteClick = useCallback(async () => {
    const sectionFlag = strToSym(sectionKey);
    onSectionDelete(sectionFlag);
    sectionData.channels.forEach((channel) => {
      removeChannelsFromZone(group, channel.key);
    });
    await useGroupState.getState().deleteZone(group, sectionFlag);
  }, [sectionData, group, onSectionDelete, sectionKey]);

  return (
    <Draggable
      isDragDisabled={isSectionless || isEditing}
      draggableId={sectionKey}
      index={index}
    >
      {(provided) => (
        <div ref={provided.innerRef} {...provided.draggableProps}>
          <div className="card mb-4 p-0">
            <header className="flex items-center justify-between rounded-t-lg bg-gray-100 py-2 pl-3 pr-8">
              <div className="flex w-full items-center">
                {isSectionless || isEditing ? null : (
                  <div {...provided.dragHandleProps}>
                    <SixDotIcon className="my-2 mr-3 h-5 w-5 fill-gray-600" />
                  </div>
                )}
                {isEditing ? (
                  <SectionNameEditInput
                    handleEditingChange={handleEditingChange}
                    sectionTitle={sectionData.title}
                    onSectionEditNameSubmit={onSectionEditNameSubmit}
                    channels={sectionData.channels}
                    sectionKey={sectionKey}
                  />
                ) : (
                  <h2 className="text-lg font-semibold">{sectionData.title}</h2>
                )}
              </div>
              {isSectionless || isEditing ? null : (
                <EditSectionDropdown
                  handleEditClick={handleEditingChange}
                  handleDeleteClick={handleDeleteClick}
                />
              )}
            </header>
            <Channels
              listId={sectionKey}
              isNew={sectionData.isNew}
              channels={sectionData.channels}
              onChannelDelete={onChannelDelete}
            />
          </div>
        </div>
      )}
    </Draggable>
  );
}
