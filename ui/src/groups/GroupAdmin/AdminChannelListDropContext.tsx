import React, { useCallback, useState } from 'react';
import { DragDropContext, Draggable, DragUpdate } from 'react-beautiful-dnd';
import { useGroup, useRouteGroup } from '../../state/groups';
import { Channel } from '../../types/groups';
import AdminChannelListItem from './AdminChannelListItem';
import AdminChannelListSections from './AdminChannelListSections';
import ChannelManagerHeader from './ChannelManagerHeader';


interface ChannelListItem {
  key: string;
  channel: Channel;
}

interface AdminChannelListContentsProps {
  sectionedChannels: SectionList;
}

interface SectionListItem {
  title: string;
  channels: ChannelListItem[];
}

type SectionList = SectionListItem[];

export default function AdminChannelListDropContext({
  sectionedChannels,
}: AdminChannelListContentsProps) {
  const sectionList = sectionedChannels;
  const [sections, setSections] = useState<SectionList>(sectionList);

  const reorder = useCallback(
    (
      array: any[],
      sourceIndex: number,
      destinationIndex: number
    ) => {
      const result = Array.from(array);
      const [removed] = result.splice(sourceIndex, 1);
      result.splice(destinationIndex, 0, removed);
      return result;
    },
    []
  );

  const move = useCallback(
    (
      source, 
      destination, 
      droppableSource, 
      droppableDestination
    ) => {
      // debugger;
      const sourceClone = Array.from(source);
      const destinationClone = Array.from(destination);
      const [removed] = sourceClone.splice(droppableSource.index, 1);
      destinationClone.splice(droppableDestination.index, 0, removed);
      const result = {};
      result[droppableSource.droppableId] = sourceClone;
      result[droppableDestination.droppableId] = destinationClone;
      return result;
    },
    []
  );

  const onDragEnd = useCallback(
    (result) => {
      const { source, destination } = result;
      if (!destination) {
        return;
      }

      const isDragSectionIntoOtherSection = source.droppableId === 'sections' && destination.droppableId !== 'sections';
      const isDragChannelOutsideSection = source.droppableId !== 'sections' && destination.droppableId === 'sections';

      const sourceId =  sections.findIndex(section => section.title === source.droppableId);
      const destinationId =  sections.findIndex(section => section.title === destination.droppableId);
      // debugger;

      if (isDragSectionIntoOtherSection || isDragChannelOutsideSection) {
        return;
      }

      if (sourceId === destinationId) {
        const items = reorder(sections[sourceId].channels, source.index, destination.index);
        const newSections = [...sections];
        newSections[sourceId].channels = items;
        setSections(newSections);
      } else {
        // debugger;
        const reorderedSections = move(sections[sourceId], sections[destinationId], source, destination);
        const newSections = [...sections];
        newSections[sourceId] = reorderedSections[sourceId];
        newSections[destinationId] = reorderedSections[destinationId];
        setSections(newSections.filter(section => section.channels.length));
      }
    },
    [reorder, sections, move]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
        <ChannelManagerHeader />
        <AdminChannelListSections sectionList={sections} />
    </DragDropContext>
  );
}

