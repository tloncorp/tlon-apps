import React from 'react';
import { Droppable } from 'react-beautiful-dnd';

import { useAmAdmin, useRouteGroup } from '@/state/groups';

import Section from './Section';
import { SectionMap } from './types';

interface ChannelListListSectionsProps {
  sections: SectionMap;
  orderedSections: string[];
  onSectionEditNameSubmit: (
    currentSectionKey: string,
    nextSectionTitle: string
  ) => void;
  onSectionDelete: (currentSectionKey: string) => void;
  onChannelDelete: (channelFlag: string, sectionKey: string) => void;
}

export default function ChannelsListSections({
  sections,
  orderedSections,
  onSectionEditNameSubmit,
  onSectionDelete,
  onChannelDelete,
}: ChannelListListSectionsProps) {
  const groupFlag = useRouteGroup();
  const isAdmin = useAmAdmin(groupFlag);
  if (isAdmin) {
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

  return (
    <>
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
    </>
  );
}
