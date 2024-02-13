import {
  useAddChannelMutation,
  useAmAdmin,
  useGroupMoveChannelMutation,
  useGroupMoveZoneMutation,
  useRouteGroup,
} from '@/state/groups';
import { formatUv } from '@urbit/aura';
import bigInt from 'big-integer';
import React, { useCallback, useEffect, useState } from 'react';
import {
  DragDropContext,
  DraggableLocation,
  DropResult,
} from 'react-beautiful-dnd';

import ChannelManagerHeader from './ChannelManagerHeader';
import ChannelsListSections from './ChannelsListSections';
import { SectionMap } from './types';

interface ChannelsListContentsProps {
  sectionedChannels: SectionMap;
}

export default function ChannelsListDropContext({
  sectionedChannels,
}: ChannelsListContentsProps) {
  const group = useRouteGroup();
  const isAdmin = useAmAdmin(group);
  const [sections, setSections] = useState<SectionMap>({});
  const [orderedSections, setOrderedSections] = useState<string[]>([]);
  const { mutate: addChannelMutation } = useAddChannelMutation();
  const { mutate: moveChannelMutation } = useGroupMoveChannelMutation();
  const { mutate: moveZoneMutation } = useGroupMoveZoneMutation();

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

      nextSections.default.channels = nextSections.default.channels.concat(
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
      addChannelMutation({
        flag: groupFlag,
        nest,
        zone: zoneName,
      });
    },
    [addChannelMutation]
  );

  const setChannelIndex = useCallback(
    async (
      nest: string,
      zoneID: string,
      groupFlag: string,
      destinationIndex: number
    ) => {
      moveChannelMutation({
        flag: groupFlag,
        nest,
        zone: zoneID,
        idx: destinationIndex,
      });
    },
    [moveChannelMutation]
  );

  const reorderSectionMap = useCallback(
    (
      sectionMap: SectionMap,
      source: DraggableLocation,
      destination: DraggableLocation
    ) => {
      const current = [...sectionMap[source.droppableId].channels];
      const next = [...sectionMap[destination.droppableId].channels];
      const target = current[source.index];

      // move to same list
      if (source.droppableId === destination.droppableId) {
        const reordered = reorder(current, source.index, destination.index);
        const result: SectionMap = {
          ...sectionMap,
          [source.droppableId]: {
            title: sectionMap[source.droppableId].title,
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
        [source.droppableId]: {
          title: sectionMap[source.droppableId].title,
          channels: current,
        },
        [destination.droppableId]: {
          title: sectionMap[destination.droppableId].title,
          channels: next,
        },
      };
      target.channel.zone = destination.droppableId;

      setChannelZone(target.key, destination.droppableId, group);
      setChannelIndex(
        target.key,
        destination.droppableId,
        group,
        destination.index
      );
      return result;
    },
    [reorder, group, setChannelZone, setChannelIndex]
  );

  const onDragEnd = useCallback(
    async (result: DropResult) => {
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

        moveZoneMutation({
          flag: group,
          zone: result.draggableId,
          index: destination.index,
        });

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
    [
      orderedSections,
      reorder,
      reorderSectionMap,
      sections,
      group,
      moveZoneMutation,
    ]
  );

  if (isAdmin) {
    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <ChannelManagerHeader addSection={addSection} />
        <ChannelsListSections
          sections={sections}
          orderedSections={orderedSections}
          onSectionEditNameSubmit={onSectionEditNameSubmit}
          onSectionDelete={onSectionDelete}
          onChannelDelete={onChannelDelete}
        />
      </DragDropContext>
    );
  }
  return (
    <>
      <ChannelManagerHeader addSection={addSection} />
      <ChannelsListSections
        sections={sections}
        orderedSections={orderedSections}
        onSectionEditNameSubmit={onSectionEditNameSubmit}
        onSectionDelete={onSectionDelete}
        onChannelDelete={onChannelDelete}
      />
    </>
  );
}
