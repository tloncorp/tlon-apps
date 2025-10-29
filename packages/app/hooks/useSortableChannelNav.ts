import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { isEqual } from 'lodash';
import { useCallback, useMemo, useRef } from 'react';

import type { GroupNavSectionWithChannels } from '../ui/components/ManageChannels/ManageChannelsShared';

const logger = createDevLogger('useChannelOrdering', true);

type GroupNavigationUpdate = Array<{
  sectionId: string;
  sectionIndex: number;
  channels: Array<{ channelId: string; channelIndex: number }>;
}>;

export type SortableSection = {
  id: string;
  title: string;
  channels: SortableChannel[];
};

type SortableChannel = {
  id: string;
  type: db.ChannelType;
  title: string;
  index?: number;
};

export type SortableListItem =
  | {
      type: 'section-header';
      id: string;
      sectionId: string;
      sectionTitle: string;
      sectionIndex: number;
      totalSections: number;
      isEmpty: boolean;
      isDefault: boolean;
      section: SortableSection;
    }
  | {
      type: 'channel';
      id: string;
      channel: SortableChannel;
      sectionId: string;
      channelIndex: number;
      sectionIndex: number;
    };

interface UseChannelOrderingProps {
  groupNavSectionsWithChannels: GroupNavSectionWithChannels[];
  updateGroupNavigation: (
    navSections: Array<{
      sectionId: string;
      sectionIndex: number;
      channels: Array<{ channelId: string; channelIndex: number }>;
    }>
  ) => Promise<void>;
}

export function useChannelOrdering({
  groupNavSectionsWithChannels,
  updateGroupNavigation,
}: UseChannelOrderingProps) {
  // Transform raw section data into orderable sections
  const sections = useMemo(() => {
    return groupNavSectionsWithChannels.map((s) => ({
      id: s.sectionId,
      title: s.title ?? 'Untitled Section',
      channels: s.channels.map((c) => ({
        id: c.id,
        title: c.title ?? 'Untitled Channel',
        type: c.type,
        index: c.index,
      })),
    }));
  }, [groupNavSectionsWithChannels]);

  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  // Build flat list data for rendering
  const sortableNavItems = useMemo<SortableListItem[]>(() => {
    const items: SortableListItem[] = [];

    sections.forEach((section, sectionIndex) => {
      // Add section header (include full section object)
      items.push({
        type: 'section-header',
        id: `section-header-${section.id}`,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionIndex,
        totalSections: sections.length,
        isEmpty: section.id !== 'default' && section.channels.length === 0,
        isDefault: section.id === 'default',
        section, // Include full section object
      });

      // Add channels
      section.channels.forEach((channel, channelIndex) => {
        items.push({
          type: 'channel',
          id: channel.id,
          channel,
          sectionId: section.id,
          channelIndex: channel.index ?? channelIndex,
          sectionIndex,
        });
      });
    });

    return items;
  }, [sections]);

  const handleActiveItemDropped = useCallback(
    async (params: {
      fromIndex: number;
      toIndex: number;
      indexToKey: string[];
    }) => {
      const { indexToKey } = params;

      const reorderedItems = indexToKey
        .map((key) => sortableNavItems.find((item) => item.id === key))
        .filter((item): item is SortableListItem => item !== undefined);

      const newNavStructure = buildNavigationStructure(reorderedItems);

      // Build a comparable structure from existing sections
      const oldNavStructure = sections.map((section, idx) => ({
        sectionId: section.id,
        sectionIndex: idx,
        channels: section.channels.map((channel, chanIdx) => ({
          channelId: channel.id,
          channelIndex: chanIdx,
        })),
      }));

      // Deep equality check to detect any navigation changes
      if (isEqual(oldNavStructure, newNavStructure)) {
        return;
      }

      try {
        await updateGroupNavigation(newNavStructure);
      } catch (e) {
        logger.error('Failed to update group navigation:', e);
      }
    },
    [sortableNavItems, sections, updateGroupNavigation]
  );

  return {
    sortableNavItems,
    handleActiveItemDropped,
  };
}

function buildNavigationStructure(
  reorderedItems: SortableListItem[]
): GroupNavigationUpdate {
  const newNavStructure: GroupNavigationUpdate = [];
  let currentSection: GroupNavigationUpdate[number] | null = null;

  for (const item of reorderedItems) {
    if (item.type === 'section-header') {
      currentSection = {
        sectionId: item.sectionId,
        sectionIndex: newNavStructure.length,
        channels: [],
      };
      newNavStructure.push(currentSection);
    } else if (item.type === 'channel' && currentSection) {
      currentSection.channels.push({
        channelId: item.channel.id,
        channelIndex: currentSection.channels.length,
      });
    }
  }

  return newNavStructure;
}
