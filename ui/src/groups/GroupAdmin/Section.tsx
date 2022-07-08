import React, { useState } from 'react';
import { DraggableProvided } from 'react-beautiful-dnd';
import { Channel } from '@/types/groups';
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
      </div>
    </div>
    
  );
}