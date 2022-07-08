import React, { useState, useCallback } from 'react';
import { DraggableProvided, Draggable, Droppable } from 'react-beautiful-dnd';
import { Channel } from '@/types/groups';
import AdminChannelListItem from './AdminChannelListItem';
import SixDotIcon from '../../components/icons/SixDotIcon';

interface ChannelListItem {
  key: string;
  channel: Channel;
}


interface SectionProps {
  channels: ChannelListItem[];
  title: string;
  provided: DraggableProvided;
}

export default function Section({channels, title, provided}: SectionProps) {

  const renderChannelListItem = useCallback(
    ({ channel, key }: ChannelListItem, index: number) => (
      <Draggable key={key} draggableId={key} index={index}>
        {(channelProvided, snapshot) => (
          <AdminChannelListItem
            provided={channelProvided}
            key={key}
            index={index}
            channel={channel}
            channelFlag={key}
          />
        )}
      </Draggable>
    ),
    []
  );

  return(
    <div ref={provided.innerRef} {...provided.draggableProps}>
      <div className="card p-0">
        <header className='flex items-center rounded-lg bg-gray-100 px-3 py-2'>
          <div
          {...provided.dragHandleProps}
          >
            <SixDotIcon className='mr-3 h-5 w-5 fill-gray-600' />
          </div>
          <h2 className='text-lg font-semibold'>{title}</h2>
        </header>
        <Droppable droppableId={title}>
          {(sectionDroppableProvided, snapshot) => (
            <div
            ref={sectionDroppableProvided.innerRef}
            {...sectionDroppableProvided.droppableProps}
            >
              {channels.map((channel, index) => channel !== undefined ? renderChannelListItem(channel, index) : null )}
              {sectionDroppableProvided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </div>
    
  );
}