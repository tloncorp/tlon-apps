import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import PinIcon16 from '@/components/icons/PinIcon16';
import SixDotIcon from '@/components/icons/SixDotIcon';
import Channels from '@/groups/ChannelsList/Channels';
import EditSectionDropdown from '@/groups/ChannelsList/EditSectionDropdown';
import SectionNameEditInput from '@/groups/ChannelsList/SectionNameEditInput';
import { SectionListItem } from '@/groups/ChannelsList/types';
import { strToSym } from '@/logic/utils';
import {
  useAddChannelMutation,
  useAmAdmin,
  useGroupCompatibility,
  useGroupDeleteZoneMutation,
  useRouteGroup,
} from '@/state/groups';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { Draggable } from 'react-beautiful-dnd';

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
  const { compatible, text } = useGroupCompatibility(group);
  const [isEditing, setIsEditing] = useState(false);
  const isSectionless = sectionKey === 'default';
  const { mutate: addChannelMutation, status: saveStatus } =
    useAddChannelMutation();
  const { mutate: deleteZoneMutation } = useGroupDeleteZoneMutation();

  useEffect(() => {
    if (sectionData.isNew === true) {
      setIsEditing(true);
    }
  }, [sectionData.isNew]);

  const handleEditingChange = useCallback(() => {
    setIsEditing(!isEditing);
  }, [isEditing]);

  const removeChannelsFromZone = useCallback(
    (groupFlag: string, nest: string) => {
      addChannelMutation({
        flag: groupFlag,
        nest,
        zone: 'default',
      });
    },
    [addChannelMutation]
  );

  const handleDeleteClick = useCallback(async () => {
    const sectionFlag = strToSym(sectionKey);
    onSectionDelete(sectionFlag);
    sectionData.channels.forEach((channel) => {
      removeChannelsFromZone(group, channel.key);
    });
    deleteZoneMutation({
      flag: group,
      zone: sectionFlag,
    });
  }, [
    sectionData,
    group,
    onSectionDelete,
    sectionKey,
    deleteZoneMutation,
    removeChannelsFromZone,
  ]);

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
          <div
            ref={provided.innerRef}
            {...(compatible ? provided.draggableProps : {})}
          >
            <div className="card mb-4 px-0 pb-3 pt-0">
              <header className="flex items-center justify-between rounded-t-lg bg-white px-2 pb-2 pt-4 md:px-8 md:pt-8">
                <div className="flex flex-col">
                  <div className="flex w-full items-center">
                    {isSectionless || isEditing ? null : (
                      <div {...(compatible ? provided.dragHandleProps : {})}>
                        <SixDotIcon
                          className={cn(
                            'mr-3 h-5 w-5',
                            compatible
                              ? 'fill-gray-600'
                              : 'cursor-not-allowed fill-gray-200'
                          )}
                        />
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
                        sectionKey={sectionKey}
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
    <div className="card mb-4 px-0 pb-3 pt-0">
      <header className="flex items-center justify-between rounded-t-lg bg-white px-2 pb-2 pt-4 md:px-8 md:pt-8">
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
