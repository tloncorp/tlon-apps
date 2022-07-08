import React, {useCallback, useState} from 'react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import { Channel } from '@/types/groups';
import AdminChannelListItem from '@/groups/GroupAdmin/AdminChannelListItem';
import Section from './Section';

interface ChannelListItem {
  key: string;
  channel: Channel;
}

interface AdminChannelListSectionsProps {
  sectionList: SectionListItem[];
}

interface SectionListItem {
  title: string;
  channels: ChannelListItem[];
}

type SectionList = SectionListItem[];

export default function AdminChannelListSections({sectionList}: AdminChannelListSectionsProps) {
  const sections = sectionList;
  // const [sections, setSections] = useState<ChannelListItem[]>(list);

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

  const renderSection = useCallback(
    ({channels, title}: SectionListItem, index: number) => (
      <Draggable key={title} draggableId={title} index={index}>
        {
          (provided, snapshot) => (
            <Section
              provided={provided}
              title={title}
              channels={channels}
            />
          )
        }
      </Draggable>
    ),
    []
  );

  return(
    <Droppable droppableId="sections">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              className=""
              {...provided.droppableProps}
            >
              {sections.map((section, index) =>
                section !== undefined
                  ? renderSection(section, index)
                  : null
              )}
              {provided.placeholder}
            </div>
          )}
    </Droppable>
  );
}