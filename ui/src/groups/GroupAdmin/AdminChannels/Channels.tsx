import React from 'react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import { ChannelListItem } from './types';
import AdminChannelListItem from './AdminChannelListItem';
import EmptySectionTools from './EmptySectionTools';

interface ChannelsProps {
  listId: string;
  channels: ChannelListItem[];
  onChannelDelete: (channelFlag: string, sectionKey: string) => void;
}

export default function Channels({
  channels,
  listId,
  onChannelDelete,
}: ChannelsProps) {
  return (
    <Droppable droppableId={listId} type="CHANNELS">
      {(provided) => (
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
                      sectionKey={listId}
                      onChannelDelete={onChannelDelete}
                      snapshot={dragSnapshot}
                      channelFlag={channel.key}
                      channel={channel.channel}
                      provided={dragProvided}
                    />
                  )}
                </Draggable>
              ))
            ) : (
              <EmptySectionTools sectionKey={listId} />
            )}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
}
