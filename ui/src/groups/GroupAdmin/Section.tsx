import React, { useState, useCallback } from 'react';
import { DraggableProvided, Draggable, Droppable } from 'react-beautiful-dnd';
import { Channel } from '@/types/groups';
import AdminChannelListItem from './AdminChannelListItem';
import Channels from './Channels';
import SixDotIcon from '../../components/icons/SixDotIcon';

interface ChannelListItem {
  key: string;
  channel: Channel;
}

interface SectionListItem {
  title: string;
  channels: ChannelListItem[];
}

interface SectionProps {
  sectionData: SectionListItem;
  sectionKey: string;
  index: number;
}

export default function Section({
  sectionData,
  sectionKey,
  index,
}: SectionProps) {
  return (
    <Draggable draggableId={sectionKey} index={index}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps}>
          <div className="card mb-4 p-0 pb-6">
            <header className="flex items-center rounded-t-lg bg-gray-100 px-3 py-2">
              <div {...provided.dragHandleProps}>
                <SixDotIcon className="mr-3 h-5 w-5 fill-gray-600" />
              </div>
              <h2 className="text-lg font-semibold">{sectionData.title}</h2>
            </header>
            <Channels listId={sectionKey} channels={sectionData.channels} />
          </div>
        </div>
      )}
    </Draggable>
  );
}
