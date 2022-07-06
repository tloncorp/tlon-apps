import React, { useRef, useState } from 'react';
import {useDrag, useDrop, XYCoord} from 'react-dnd';
import * as Switch from '@radix-ui/react-switch';
import { Channel } from '../../types/groups';
import EditChannelNameModal from './EditChannelNameModal';
import PencilIcon from '../../components/icons/PencilIcon';
import AdminChannelListDropdown from './AdminChannelListDropdown';
import SixDotIcon from '../../components/icons/SixDotIcon';

interface AdminChannelListItemProps {
  channel: Channel;
  index: number;
  moveChannel: (dragIndex: number, hoverIndex: number) => void;
}

interface DragItem {
  index: number;
  id: string;
  type: string;
}

const ItemTypes = {
  CHANNEL: 'channel',
};


export default function AdminChannelListItem({
  channel,
  index,
  moveChannel
}: AdminChannelListItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { meta } = channel;
  const [editIsOpen, setEditIsOpen] = useState(false);

  const [{handlerId}, drop] = useDrop<DragItem, void, {handlerId: any | null}>({
    accept: ItemTypes.CHANNEL,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId()
      };
    },
    hover(item: DragItem, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = ref.current?.getBoundingClientRect();

      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      const clientOffset = monitor.getClientOffset();

      const hoverClientY = (clientOffset as unknown as XYCoord).y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY ) {
        return;
      }

      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      moveChannel(dragIndex, hoverIndex);

      // eslint-disable-next-line no-param-reassign
      item.index = hoverIndex;
    }
  });

  const [{isDragging}, drag] = useDrag({
    type: ItemTypes.CHANNEL,
    item: () => ({channel, index}),
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    })
  });

  drag(drop(ref));

  return (
    <>
      <div ref={ref}>
        <div className={"my-5 flex items-center justify-between"} style={{opacity: isDragging ? 0 : 1}} data-handler-id={handlerId}>
          <div className="flex items-center">
            <SixDotIcon className="mr-3 h-5 w-5 fill-gray-600" />
            <div>
              <div className="flex items-center">
                <h2 className="font-semibold">{meta.title}</h2>
                <div onClick={() => setEditIsOpen(!editIsOpen)}>
                  <PencilIcon  className="mx-3 h-3 w-3 cursor-pointer fill-gray-500" />
                </div>
              </div>
              <div className="text-sm font-semibold text-gray-400">Chat</div>
            </div>
          </div>
          <AdminChannelListDropdown />
          <div className="flex items-center text-gray-800">
            Default
            <Switch.Root className="switch">
              <Switch.Thumb className="switch-thumb" />
            </Switch.Root>
          </div>
        </div>
      </div>
      <EditChannelNameModal editIsOpen={editIsOpen} setEditIsOpen={setEditIsOpen} />
    </>
  );
}
