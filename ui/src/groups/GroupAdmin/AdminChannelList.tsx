// import { update } from 'lodash';
import useImmer, { produce } from 'immer';
import React, {useCallback, useState} from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useGroup, useRouteGroup } from '../../state/groups';
import { Channel } from '../../types/groups';
import AdminChannelListItem from './AdminChannelListItem';

interface ChannelListItem {
  key: string,
  channel: Channel
}

interface AdminChannelListContentsProps {
  channelList: ChannelListItem[];
}

// interface AdminChannelListState {
//   channels: ChannelListItem[]
// }

function AdminChannelListContents({channelList}: AdminChannelListContentsProps) {
  const list = channelList;
  const [channels, setChannels] = useState<ChannelListItem[]>(list);
  // console.log(channels);
  const moveChannel = useCallback((dragIndex: number, hoverIndex: number) => {
    setChannels(produce((draft) => {
      // console.log(`drag: ${dragIndex}, hover: ${hoverIndex}`);
      const prevChannels = draft.slice(0);
      draft.splice(dragIndex, 1);
      draft.splice(hoverIndex , 0, prevChannels[dragIndex]);
      console.log(draft.map((item) => item.key));
      // return nextChannels;
    }));
  }, []);

  const renderChannelListItem = useCallback(({channel, key}: ChannelListItem, index: number) => (
      <AdminChannelListItem
       key={key}
       index={index}
       channel={channel}
       moveChannel={moveChannel}
      />
    ), [moveChannel]);
  
  

  return (
    <div className="card my-5">
      {channels.map((channel, index) => renderChannelListItem(channel, index))}
    </div>
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
    channel
  }));
 return(
   <DndProvider backend={HTML5Backend}>
     <AdminChannelListContents channelList={channelList} />
   </DndProvider>
 );
}