import React, { useCallback, useState } from 'react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import { Channel } from '@/types/groups';
import AdminChannelListItem from '@/groups/GroupAdmin/AdminChannelListItem';
import Section from './Section';

interface ChannelListItem {
  key: string;
  channel: Channel;
}

interface AdminChannelListSectionsProps {
  sections: SectionMap;
  orderedSections: string[];
}

type SectionMap = {
  [key: string]: SectionListItem;
};

interface SectionListItem {
  title: string;
  channels: ChannelListItem[];
}

type SectionList = SectionListItem[];

export default function AdminChannelListSections({
  sections,
  orderedSections,
}: AdminChannelListSectionsProps) {
  return (
    <Droppable droppableId="sections" type="SECTIONS">
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          {orderedSections.map((key: string, index: number) => (
            <Section
              sectionKey={key}
              key={key}
              index={index}
              sectionData={sections[key]}
            />
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
