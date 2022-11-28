import React, { useCallback, useEffect, useState } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import SixDotIcon from '@/components/icons/SixDotIcon';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { strToSym } from '@/logic/utils';
import { SectionListItem } from '@/groups/GroupAdmin/AdminChannels/types';
import Channels from '@/groups/GroupAdmin/AdminChannels/Channels';
import EditSectionDropdown from '@/groups/GroupAdmin/AdminChannels/EditSectionDropdown';
import SectionNameEditInput from '@/groups/GroupAdmin/AdminChannels/SectionNameEditInput';
import { Status } from '@/logic/status';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

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
  const [saveStatus, setSaveStatus] = useState<Status>('initial');
  const isSectionless = sectionKey === 'default';

  useEffect(() => {
    if (sectionData.isNew === true) {
      setIsEditing(true);
    }
  }, [sectionData.isNew]);

  const handleEditingChange = useCallback(() => {
    setIsEditing(!isEditing);
  }, [isEditing]);

  const removeChannelsFromZone = async (groupFlag: string, nest: string) => {
    await useGroupState.getState().addChannelToZone('default', groupFlag, nest);
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
                {saveStatus === 'loading' && (
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                )}
                {isEditing ? (
                  <SectionNameEditInput
                    handleEditingChange={handleEditingChange}
                    sectionTitle={sectionData.title}
                    isNew={sectionData.isNew}
                    onSectionEditNameSubmit={onSectionEditNameSubmit}
                    channels={sectionData.channels}
                    sectionKey={sectionKey}
                    saveStatus={saveStatus}
                    setSaveStatus={setSaveStatus}
                  />
                ) : (
                  <h2 className="alt-highlight text-lg font-semibold">
                    {sectionData.title}
                  </h2>
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
