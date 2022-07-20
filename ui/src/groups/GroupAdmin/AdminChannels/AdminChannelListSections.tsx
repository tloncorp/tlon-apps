import React from 'react';
import { Droppable } from 'react-beautiful-dnd';
import { SectionMap } from './types';
import Section from './Section';

interface AdminChannelListSectionsProps {
  sections: SectionMap;
  orderedSections: string[];
  onSectionEditNameSubmit: (
    currentSectionKey: string,
    nextSectionTitle: string
  ) => void;
  onSectionDelete: (currentSectionKey: string) => void;
  onChannelDelete: (channelFlag: string, sectionKey: string) => void;
}

export default function AdminChannelListSections({
  sections,
  orderedSections,
  onSectionEditNameSubmit,
  onSectionDelete,
  onChannelDelete,
}: AdminChannelListSectionsProps) {
  return (
    <Droppable droppableId="sections" type="SECTIONS">
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          {orderedSections.map((key: string, index: number) => (
            <Section
              sectionKey={key}
              key={key}
              index={index}
              onSectionEditNameSubmit={onSectionEditNameSubmit}
              onSectionDelete={onSectionDelete}
              onChannelDelete={onChannelDelete}
              sectionData={sections[key]}
            />
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
