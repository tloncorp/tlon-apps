import React, { useCallback, useState } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import SixDotIcon from '@/components/icons/SixDotIcon';
import { useGroupState, useRouteGroup } from '@/state/groups';
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
  const groupFlag = useRouteGroup();
  const [isEditing, setIsEditing] = useState(false);
  const isSectionless = sectionKey === 'sectionless';

  const handleEditingChange = useCallback(() => {
    setIsEditing(!isEditing);
  }, [isEditing]);

  const handleDeleteClick = useCallback(async () => {
    onSectionDelete(sectionKey);
    await sectionData.channels.forEach((channel) => {
      useGroupState.getState().removeChannelFromZone(groupFlag, channel.key);
    });
  }, [sectionData, groupFlag, onSectionDelete, sectionKey]);

  return (
    <Draggable
      isDragDisabled={isSectionless || isEditing}
      draggableId={sectionKey}
      index={index}
    >
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps}>
          <div className="card mb-4 p-0 pb-6">
            <header className="flex items-center justify-between rounded-t-lg bg-gray-100 py-2 px-3">
              <div className="flex w-full items-center">
                {isSectionless || isEditing ? null : (
                  <div {...provided.dragHandleProps}>
                    <SixDotIcon className="my-2 mr-3 h-5 w-5 fill-gray-600" />
                  </div>
                )}
                {isEditing ? (
                  <SectionNameEditInput
                    handleEditingChange={handleEditingChange}
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
              channels={sectionData.channels}
              onChannelDelete={onChannelDelete}
            />
          </div>
        </div>
      )}
    </Draggable>
  );
}
