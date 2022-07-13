import React from 'react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import { Channel } from '@/types/groups';
import AdminChannelListItem from './AdminChannelListItem';
import EmptySectionTools from '../EmptySectionTools';

interface ChannelListItem {
  key: string;
  channel: Channel;
}
interface ChannelsProps {
  listId: string;
  channels: ChannelListItem[];
}

export default function Channels({ channels, listId }: ChannelsProps) {
  return (
    <Droppable droppableId={listId} type="CHANNELS">
      {(provided, snapshot) => (
        <div {...provided.droppableProps}>
          <div ref={provided.innerRef}>
            {channels.length ? (
              channels.map((channel, index: number) => (
                <Draggable
                  key={channel.key}
                  draggableId={channel.key}
                  index={index}
                >
                  {(dragProvided, dragSnapshot) => (
                    <AdminChannelListItem
                      channelFlag={channel.key}
                      channel={channel.channel}
                      provided={dragProvided}
                    />
                  )}
                </Draggable>
              ))
            ) : (
              <EmptySectionTools />
            )}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
}
