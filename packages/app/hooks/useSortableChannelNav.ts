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
      type: 'empty-section';
      id: string;
      sectionId: string;
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
  moveChannelWithinNavSection: (
    channelId: string,
    navSectionId: string,
    newIndex: number
  ) => Promise<void>;
  moveChannelToNavSection: (
    channelId: string,
    navSectionId: string
  ) => Promise<void>;
}

function findNewSectionForChannel(
  reorderedItems: OrderableChannelNavItem[],
  channelIndex: number
): string | null {
  for (let j = channelIndex - 1; j >= 0; j--) {
    if (reorderedItems[j]?.type === 'section-header') {
      return reorderedItems[j].sectionId;
    }
  }
  return null;
}

function getChannelsInSection(
  reorderedItems: OrderableChannelNavItem[],
  sectionId: string
): Extract<OrderableChannelNavItem, { type: 'channel' }>[] {
  return reorderedItems.filter(
    (item) => item?.type === 'channel' && item.sectionId === sectionId
  ) as Extract<OrderableChannelNavItem, { type: 'channel' }>[];
}

function calculateChannelIndexInSection(
  sectionChannels: Extract<OrderableChannelNavItem, { type: 'channel' }>[],
  channelId: string
): number {
  return sectionChannels.findIndex((item) => item.id === channelId);
}

export function useChannelOrdering({
  groupNavSectionsWithChannels,
  moveChannelWithinNavSection,
  moveChannelToNavSection,
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

      // Add empty section message if no channels
      if (section.channels.length === 0) {
        items.push({
          type: 'empty-section',
          id: `empty-${section.id}`,
          sectionId: section.id,
        });
      }

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

  const handleMoveChannelWithinNavSection = useCallback(
    async (channelId: string, sectionId: string, newIndex: number) => {
      const currentSections = sectionsRef.current;

      logger.log('handleMoveChannelWithinNavSection called:', {
        channelId,
        sectionId,
        newIndex,
        sectionChannels: currentSections
          .find((s) => s.id === sectionId)
          ?.channels.map((c) => c.id),
      });

      const sectionIndex = currentSections.findIndex((s) => s.id === sectionId);
      if (sectionIndex === -1) {
        logger.error('Invalid section ID:', sectionId);
        return;
      }

      const channelIndex = currentSections[sectionIndex].channels.findIndex(
        (c) => c.id === channelId
      );
      if (channelIndex === -1) {
        logger.error(
          `Channel not found: ${channelId} (expected in section ${sectionId})`
        );
        logger.error(
          'Available channels:',
          currentSections[sectionIndex].channels.map((c) => c.id)
        );
        return;
      }

      logger.log('Moving channel:', {
        from: channelIndex,
        to: newIndex,
      });

      if (
        newIndex < 0 ||
        newIndex >= currentSections[sectionIndex].channels.length
      ) {
        logger.error(
          'Invalid new index:',
          newIndex,
          'for section with',
          currentSections[sectionIndex].channels.length,
          'channels'
        );
        return;
      }

      try {
        await moveChannelWithinNavSection(channelId, sectionId, newIndex);
      } catch (e) {
        logger.error('Failed to move channel within section:', e);
      }
    },
    [moveChannelWithinNavSection]
  );

  const handleMoveChannelToNavSection = useCallback(
    async (
      channelId: string,
      newSectionId: string,
      previousSectionId: string
    ) => {
      const currentSections = sectionsRef.current;
      const previousSectionIndex = currentSections.findIndex(
        (s) => s.id === previousSectionId
      );

      if (previousSectionIndex === -1) {
        logger.error('Invalid previous section ID:', previousSectionId);
        return;
      }

      if (newSectionId === previousSectionId) {
        logger.error(
          `Cannot move channel to section "${currentSections[previousSectionIndex].title}" as it is already there`
        );
        return;
      }

      const channel = currentSections[previousSectionIndex].channels.find(
        (c) => c.id === channelId
      );

      if (!channel) {
        logger.error(
          `Channel not found: ${channelId} (expected in section ${previousSectionId})`
        );
        return;
      }

      const sectionIndex = currentSections.findIndex(
        (s) => s.id === newSectionId
      );
      if (sectionIndex === -1) {
        logger.error('Invalid new section ID:', newSectionId);
        return;
      }

      try {
        await moveChannelToNavSection(channelId, newSectionId);
      } catch (e) {
        logger.error('Failed to move channel to new section:', e);
      }
    },
    [moveChannelToNavSection]
  );

  const handleActiveItemDropped = useCallback(
    async (params: {
      fromIndex: number;
      toIndex: number;
      indexToKey: string[];
    }) => {
      const { fromIndex, toIndex, indexToKey } = params;

      logger.log('handleActiveItemDropped called', {
        fromIndex,
        toIndex,
        indexToKeyLength: indexToKey.length,
      });

      const reorderedItems = indexToKey
        .map((key) => sortableNavItems.find((item) => item.id === key))
        .filter((item): item is OrderableChannelNavItem => item !== undefined);

      const movedItem = sortableNavItems[fromIndex];
      logger.log('movedItem:', movedItem);

      if (!movedItem || movedItem.type !== 'channel') {
        logger.log('movedItem is not a channel, skipping');
        return;
      }

      const newSectionId = findNewSectionForChannel(reorderedItems, toIndex);
      logger.log('newSectionId:', newSectionId);

      if (!newSectionId) {
        logger.log('newSectionId is null, skipping');
        return;
      }

      const updatedReorderedItems = reorderedItems.map((item) =>
        item.id === movedItem.id && item.type === 'channel'
          ? { ...item, sectionId: newSectionId }
          : item
      );

      const sectionChannels = getChannelsInSection(
        updatedReorderedItems,
        newSectionId
      );

      logger.log('sectionChannels:', {
        count: sectionChannels.length,
        channelIds: sectionChannels.map((c) => c.id),
      });

      const newChannelIndex = calculateChannelIndexInSection(
        sectionChannels,
        movedItem.id
      );

      logger.log('Calculated positions:', {
        movedItemSectionId: movedItem.sectionId,
        newSectionId,
        newChannelIndex,
        movedItemChannelIndex: movedItem.channelIndex,
      });

      if (newChannelIndex === -1) {
        logger.log('newChannelIndex is -1, skipping');
        return;
      }

      if (movedItem.sectionId !== newSectionId) {
        logger.log(
          `Moving channel ${movedItem.id} from section ${movedItem.sectionId} to ${newSectionId}`
        );
        await handleMoveChannelToNavSection(
          movedItem.id,
          newSectionId,
          movedItem.sectionId
        );
        logger.log(
          `Note: Channel will be added at position 0. Desired position was ${newChannelIndex}`
        );
        // TODO: The backend only supports adding channels at position 0.
        // To move to a different position, we would need to wait for the state
        // to update after the move, then call handleMoveChannelWithinNavSection.
        // For now, channels moved between sections always go to position 0.
        return;
      }

      if (newChannelIndex !== movedItem.channelIndex) {
        logger.log(
          `Reordering channel ${movedItem.id} within section ${movedItem.sectionId} to index ${newChannelIndex}`
        );
        handleMoveChannelWithinNavSection(
          movedItem.id,
          movedItem.sectionId,
          newChannelIndex
        );
      }
    },
    [
      sortableNavItems,
      handleMoveChannelToNavSection,
      handleMoveChannelWithinNavSection,
    ]
  );

  return {
    sortableNavItems,
    handleActiveItemDropped,
  };
}
