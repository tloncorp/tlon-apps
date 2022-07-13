import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Channel } from '@/types/groups';
import Channels from './Channels';
import SixDotIcon from '../../../components/icons/SixDotIcon';

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
    <Draggable
      isDragDisabled={sectionKey === 'sectionless'}
      draggableId={sectionKey}
      index={index}
    >
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps}>
          <div className="card mb-4 p-0 pb-6">
            <header className="flex items-center rounded-t-lg bg-gray-100 py-2 px-3">
              {sectionKey !== 'sectionless' ? (
                <div {...provided.dragHandleProps}>
                  <SixDotIcon className="mr-3 h-5 w-5 fill-gray-600" />
                </div>
              ) : null}

              <h2 className="text-lg font-semibold">{sectionData.title}</h2>
            </header>
            <Channels listId={sectionKey} channels={sectionData.channels} />
          </div>
        </div>
      )}
    </Draggable>
  );
}
