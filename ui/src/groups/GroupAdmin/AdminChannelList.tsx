import React, { useCallback, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useGroup, useRouteGroup } from '../../state/groups';
import { Channel } from '../../types/groups';
import AdminChannelListItem from './AdminChannelListItem';

interface ChannelListItem {
  key: string;
  channel: Channel;
}

interface AdminChannelListContentsProps {
  channelList: ChannelListItem[];
}

function AdminChannelListContents({
  channelList,
}: AdminChannelListContentsProps) {
  const list = channelList;
  const [channels, setChannels] = useState<ChannelListItem[]>(list);

  const reorder = useCallback(
    (
      currentChannels: ChannelListItem[],
      sourceIndex: number,
      destinationIndex: number
    ) => {
      const result = Array.from(currentChannels);
      const [removed] = result.splice(sourceIndex, 1);
      result.splice(destinationIndex, 0, removed);

      setChannels(result);
    },
    []
  );

  const renderChannelListItem = useCallback(
    ({ channel, key }: ChannelListItem, index: number) => (
      <Draggable key={key} draggableId={key} index={index}>
        {(provided, snapshot) => (
          <AdminChannelListItem
            provided={provided}
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

  const onDragEnd = useCallback(
    (result) => {
      const { source, destination } = result;
      if (!result.destination) {
        return;
      }

      if (source.droppableId === destination.droppableId) {
        reorder(channels, source.index, destination.index);
      }
    },
    [reorder, channels]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="unzoned">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            className="card my-5"
            {...provided.droppableProps}
          >
            {channels.map((channel, index) =>
              channel !== undefined
                ? renderChannelListItem(channel, index)
                : null
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

export default function AdminChannelList() {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  if (!group) {
    return null;
  }

  const channelList = Object.entries(group.channels).map(([key, channel]) => ({
    key,
    channel,
  }));

  return <AdminChannelListContents channelList={channelList} />;
}
