import React from 'react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import { useAmAdmin, useRouteGroup } from '@/state/groups';
import ChannelsListItem from '@/groups/ChannelsList/ChannelsListItem';
import { ChannelListItem } from './types';
import EmptySectionTools from './EmptySectionTools';

interface ChannelsProps {
  listId: string;
  channels: ChannelListItem[];
  isNew?: boolean;
  onChannelDelete: (channelFlag: string, sectionKey: string) => void;
}

export default function Channels({
  channels,
  listId,
  isNew,
  onChannelDelete,
}: ChannelsProps) {
  const flag = useRouteGroup();
  const isAdmin = useAmAdmin(flag);

  if (isAdmin) {
    return (
      <Droppable
        isDropDisabled={isNew || !isAdmin}
        droppableId={listId}
        type="CHANNELS"
      >
        {(provided) => (
          <div {...provided.droppableProps}>
            <div ref={provided.innerRef}>
              {channels.length
                ? channels.map((channel, index: number) => (
                    <Draggable
                      key={channel.key}
                      draggableId={channel.key}
                      index={index}
                    >
                      {(dragProvided, dragSnapshot) => (
                        <ChannelsListItem
                          sectionKey={listId}
                          onChannelDelete={onChannelDelete}
                          snapshot={dragSnapshot}
                          nest={channel.key}
                          channel={channel.channel}
                          provided={dragProvided}
                        />
                      )}
                    </Draggable>
                  ))
                : null}
              {!channels.length && isNew !== true ? (
                <EmptySectionTools sectionKey={listId} />
              ) : null}
              {isNew === true ? (
                <div className="flex items-center py-4 px-5">
                  <h2 className="font-semibold text-gray-600">
                    Please give this Section a name
                  </h2>
                </div>
              ) : null}
              {provided.placeholder}
            </div>
          </div>
        )}
      </Droppable>
    );
  }

  return (
    <div>
      {channels.length ? (
        channels.map((channel) => (
          <ChannelsListItem
            sectionKey={listId}
            onChannelDelete={onChannelDelete}
            nest={channel.key}
            channel={channel.channel}
            key={channel.key}
          />
        ))
      ) : (
        <div />
      )}
    </div>
  );
}
