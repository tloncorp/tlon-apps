import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo, useRef } from 'react';

const logger = createDevLogger('useChannelOrdering', true);

export type OrderableChannelSection = {
  id: string;
  title: string;
  channels: OrderableChannelItem[];
};

type OrderableChannelItem = {
  id: string;
  type: db.ChannelType;
  title: string;
  index?: number;
};

export type OrderableChannelNavItem =
  | {
      type: 'section-header';
      id: string;
      sectionId: string;
      sectionTitle: string;
      sectionIndex: number;
      totalSections: number;
      isEmpty: boolean;
      isDefault: boolean;
      section: OrderableChannelSection;
    }
  | {
      type: 'channel';
      id: string;
      channel: OrderableChannelItem;
      sectionId: string;
      channelIndex: number;
      sectionIndex: number;
    };

type ChannelWithIndex = db.Channel & {
  index?: number;
};

type GroupNavSectionWithChannels = Omit<db.GroupNavSection, 'channels'> & {
  channels: ChannelWithIndex[];
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
  const sortableNavItems = useMemo<OrderableChannelNavItem[]>(() => {
    const items: OrderableChannelNavItem[] = [];

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
        .filter((item): item is OrderableChannelNavItem => item !== undefined);

      const newNavStructure: Array<{
        sectionId: string;
        sectionIndex: number;
        channels: Array<{ channelId: string; channelIndex: number }>;
      }> = [];

      let currentSection: typeof newNavStructure[number] | null = null;

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

      // Compare by section ID, not by index, since sections might have been reordered
      let hasChanges = newNavStructure.some((newSection) => {
        const oldSection = sections.find((s) => s.id === newSection.sectionId);
        if (!oldSection) return true;
        if (newSection.channels.length !== oldSection.channels.length) return true;
        return newSection.channels.some(
          (newChan, chanIdx) =>
            oldSection.channels[chanIdx]?.id !== newChan.channelId
        );
      }) || newNavStructure.length !== sections.length;

      if (!hasChanges) {
        hasChanges = newNavStructure.some(
          (newSection, idx) => sections[idx]?.id !== newSection.sectionId
        );
      }

      if (!hasChanges) {
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
