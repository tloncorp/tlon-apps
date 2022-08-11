import React, { useCallback, useEffect, useState } from 'react';
import { DragDropContext, DraggableLocation } from 'react-beautiful-dnd';
import bigInt from 'big-integer';
import { formatUv } from '@urbit/aura';
import { useGroupState, useRouteGroup } from '@/state/groups';
import { SectionMap } from './types';
import AdminChannelListSections from './AdminChannelListSections';
import ChannelManagerHeader from './ChannelManagerHeader';

interface AdminChannelListContentsProps {
  sectionedChannels: SectionMap;
}

export default function AdminChannelListDropContext({
  sectionedChannels,
}: AdminChannelListContentsProps) {
  const group = useRouteGroup();
  const [sections, setSections] = useState<SectionMap>({});
  const [orderedSections, setOrderedSections] = useState<string[]>([]);

  useEffect(() => {
    setSections(sectionedChannels);
    setOrderedSections(Object.keys(sectionedChannels));
  }, [sectionedChannels]);

  const onSectionEditNameSubmit = useCallback(
    (currentSectionKey: string, nextSectionTitle: string) => {
      const nextSections = sections;

      // if zone has no title, cancel edit
      if (!nextSectionTitle.length) {
        return;
      }

      nextSections[currentSectionKey].title = nextSectionTitle;
      nextSections[currentSectionKey].isNew = false;
      setSections({ ...nextSections });
    },
    [sections]
  );

  const onSectionDelete = useCallback(
    (currentSectionKey: string) => {
      const nextSections = sections;
      const nextOrderedSections = orderedSections;
      const orderedSectionsIndex = orderedSections.indexOf(currentSectionKey);

      nextSections[''].channels = nextSections[''].channels.concat(
        sections[currentSectionKey].channels
      );

      nextOrderedSections.splice(orderedSectionsIndex, 1);
      delete nextSections[currentSectionKey];

      setSections(nextSections);
      setOrderedSections(nextOrderedSections);
    },
    [orderedSections, sections]
  );

  const onChannelDelete = (nest: string, sectionKey: string) => {
    const nextSections = sections;
    nextSections[sectionKey].channels = nextSections[
      sectionKey
    ].channels.filter((channel) => channel.key !== nest);
    setSections(nextSections);
  };

  const addSection = () => {
    if (
      Object.keys(sections).filter((key) => sections[key].isNew === true).length
    ) {
      return;
    }
    const nextSection = {
      title: '',
      isNew: true,
      channels: [],
    };

    const idParts = formatUv(bigInt(Date.now())).split('.');
    const nextSectionId = `z${idParts[idParts.length - 1]}`;
    const nextSections = {
      ...sections,
      [nextSectionId]: nextSection,
    };

    const nextOrderedSections = orderedSections;

    nextOrderedSections.splice(1, 0, nextSectionId);
    setSections(nextSections);
    setOrderedSections(nextOrderedSections);
  };

  const reorder = useCallback(
    (array: any[], sourceIndex: number, destinationIndex: number) => {
      const result = Array.from(array);
      const [removed] = result.splice(sourceIndex, 1);
      result.splice(destinationIndex, 0, removed);
      return result;
    },
    []
  );

  const setChannelZone = useCallback(
    async (nest: string, zoneName: string, groupFlag: string) => {
      await useGroupState
        .getState()
        .addChannelToZone(zoneName, groupFlag, nest);
    },
    []
  );

  const setChannelIndex = useCallback(
    async (
      nest: string,
      zoneID: string,
      groupFlag: string,
      destinationIndex: number
    ) => {
      const zone = zoneID === 'sectionless' ? '' : zoneID;
      await useGroupState
        .getState()
        .moveChannel(groupFlag, zone, nest, destinationIndex);
    },
    []
  );

  const reorderSectionMap = useCallback(
    (
      sectionMap: SectionMap,
      source: DraggableLocation,
      destination: DraggableLocation
    ) => {
      const sourceSectionLocator =
        source.droppableId === 'sectionless' ? '' : source.droppableId;
      const destinationSectionLocator =
        destination.droppableId === 'sectionless'
          ? ''
          : destination.droppableId;

      const current = [...sectionMap[sourceSectionLocator].channels];
      const next = [...sectionMap[destinationSectionLocator].channels];
      const target = current[source.index];

      // move to same list
      if (source.droppableId === destination.droppableId) {
        const reordered = reorder(current, source.index, destination.index);
        const result: SectionMap = {
          ...sectionMap,
          [sourceSectionLocator]: {
            title: sectionMap[sourceSectionLocator].title,
            channels: reordered,
          },
        };

        setChannelIndex(
          target.key,
          target.channel.zone || '',
          group,
          destination.index
        );
        return result;
      }

      // move to different list
      current.splice(source.index, 1);
      next.splice(destination.index, 0, target);
      const result: SectionMap = {
        ...sectionMap,
        [sourceSectionLocator]: {
          title: sectionMap[sourceSectionLocator].title,
          channels: current,
        },
        [destinationSectionLocator]: {
          title: sectionMap[destinationSectionLocator].title,
          channels: next,
        },
      };
      target.channel.zone = destinationSectionLocator;

      setChannelZone(target.key, destinationSectionLocator, group);
      setChannelIndex(
        target.key,
        destinationSectionLocator,
        group,
        destination.index
      );
      return result;
    },
    [reorder, group, setChannelZone, setChannelIndex]
  );

  const onDragEnd = useCallback(
    (result) => {
      const { source, destination } = result;

      if (!destination) {
        return;
      }

      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      if (result.type === 'SECTIONS') {
        if (destination.index === 0) {
          return;
        }

        useGroupState
          .getState()
          .moveZone(group, result.draggableId, destination.index - 1);
        const newOrder = reorder(
          orderedSections,
          source.index,
          destination.index
        );
        setOrderedSections(newOrder);
        return;
      }

      const nextMap = reorderSectionMap(sections, source, destination);

      setSections(nextMap);
    },
    [orderedSections, reorder, reorderSectionMap, sections, group]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <ChannelManagerHeader addSection={addSection} />
      <AdminChannelListSections
        sections={sections}
        orderedSections={orderedSections}
        onSectionEditNameSubmit={onSectionEditNameSubmit}
        onSectionDelete={onSectionDelete}
        onChannelDelete={onChannelDelete}
      />
    </DragDropContext>
  );
}
