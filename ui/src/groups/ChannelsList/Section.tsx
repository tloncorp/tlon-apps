import React, { useCallback, useEffect, useState } from 'react';
import cn from 'classnames';
import { Draggable } from 'react-beautiful-dnd';
import SixDotIcon from '@/components/icons/SixDotIcon';
import { useAmAdmin, useGroupState, useRouteGroup } from '@/state/groups';
import { strToSym } from '@/logic/utils';
import { SectionListItem } from '@/groups/ChannelsList/types';
import Channels from '@/groups/ChannelsList/Channels';
import EditSectionDropdown from '@/groups/ChannelsList/EditSectionDropdown';
import SectionNameEditInput from '@/groups/ChannelsList/SectionNameEditInput';
import { Status } from '@/logic/status';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import PinIcon from '@/components/icons/PinIcon';
import PinIcon16 from '@/components/icons/PinIcon16';
import { useIsMobile } from '@/logic/useMedia';

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
  const isAdmin = useAmAdmin(group);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<Status>('initial');
  const isSectionless = sectionKey === 'default';
  const isMobile = useIsMobile();

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

  if (isSectionless && !isAdmin && sectionData.channels.length === 0) {
    return null;
  }

  if (isAdmin) {
    return (
      <Draggable
        isDragDisabled={isSectionless || isEditing}
        draggableId={sectionKey}
        index={index}
      >
        {(provided) => (
          <div ref={provided.innerRef} {...provided.draggableProps}>
            <div className="card mb-4 px-0 pt-0 pb-3">
              <header
                className={cn(
                  'flex items-center justify-between rounded-t-lg bg-white pb-2',
                  {
                    'px-2 pt-4': isMobile,
                    'px-8 pt-8': !isMobile,
                  }
                )}
              >
                <div className="flex flex-col">
                  <div className="flex w-full items-center">
                    {isSectionless || isEditing ? null : (
                      <div {...provided.dragHandleProps}>
                        <SixDotIcon className="my-2 mr-3 h-5 w-5 fill-gray-600" />
                      </div>
                    )}
                    {isSectionless ? (
                      <PinIcon16 className="my-2 mr-3 h-6 w-6 fill-gray-600" />
                    ) : null}
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
                        {isSectionless ? 'Default' : sectionData.title}
                      </h2>
                    )}
                  </div>
                  {isSectionless ? (
                    <span className="ml-[35px] font-semibold leading-4 text-gray-500">
                      Channels in this section will float to the top of the
                      channel list{' '}
                    </span>
                  ) : null}
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
  return (
    <div className="card mb-4 px-0 pt-0 pb-3">
      <header
        className={cn(
          'flex items-center justify-between rounded-t-lg bg-white pb-2',
          {
            'px-2 pt-4': isMobile,
            'px-8 pt-8': !isMobile,
          }
        )}
      >
        <div className="flex w-full items-center">
          <h2 className="alt-highlight text-lg font-semibold">
            {isSectionless ? 'Default' : sectionData.title}
          </h2>
        </div>
      </header>
      <Channels
        listId={sectionKey}
        isNew={sectionData.isNew}
        channels={sectionData.channels}
        onChannelDelete={onChannelDelete}
      />
    </div>
  );
}
