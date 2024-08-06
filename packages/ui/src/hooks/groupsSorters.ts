import { createDevLogger, logSyncDuration } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { preSig } from '@tloncorp/shared/src/urbit';
import anyAscii from 'any-ascii';
import { useMemo } from 'react';
import { isValidPatp } from 'urbit-ob';

import * as utils from '../utils';

export type AlphaGroupsSegment = {
  label: string;
  data: db.Group[];
};

export type AlphaSegmentedGroups = AlphaGroupsSegment[];

const logger = createDevLogger('groupSorter', false);

export function useAlphabeticallySegmentedGroups({
  groups,
  enabled,
}: {
  groups: db.Group[];
  enabled?: boolean;
}): AlphaSegmentedGroups {
  const segmentedContacts = useMemo(() => {
    if (!enabled) return [];
    return logSyncDuration('useAlphabeticallySegmentedContacts', logger, () => {
      const segmented: Record<
        string,
        { id: string; sortable: string; group: db.Group }[]
      > = {};

      // convert contact to alphabetical representation and bucket by first letter
      for (const group of groups) {
        const sortableName = group.title
          ? anyAscii(group.title.replace(/[~-]/g, ''))
          : group.id.replace(/[~-]/g, '');
        const firstAlpha = utils.getFirstAlphabeticalChar(sortableName);
        if (!segmented[firstAlpha]) {
          segmented[firstAlpha] = [];
        }
        segmented[firstAlpha].push({
          id: group.id,
          sortable: sortableName,
          group,
        });
      }

      // pull out non-alphabetical names
      const nonAlphaNames = segmented['Other'];
      delete segmented['Other'];

      // order groupings alphabetically and sort hits within each bucket
      const segmentedContacts = Object.entries(segmented)
        .filter(([_k, results]) => results.length > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, results]) => {
          const segmentGroups = results.map((r) => r.group).sort(groupsSorter);
          return { label, data: segmentGroups };
        });

      // add non-alphabetical names to the end
      if (nonAlphaNames && nonAlphaNames.length) {
        segmentedContacts.push({
          label: '_',
          data: nonAlphaNames.map((r) => r.group),
        });
      }

      return segmentedContacts;
    });
  }, [groups]);

  return segmentedContacts;
}

function groupsSorter(a: db.Group, b: db.Group): number {
  if (a.title && !b.title) {
    return -1;
  }

  if (b.title && !a.title) {
    return 1;
  }

  if (b.title && a.title) {
    // prioritize nicknames that don't look "urbity"
    const aIsBadNickname = a.title.charAt(0) === '~';
    const bIsBadNickname = b.title.charAt(0) === '~';
    if (aIsBadNickname && !bIsBadNickname) {
      return 1;
    }
    if (!aIsBadNickname && bIsBadNickname) {
      return -1;
    }

    // otherwise, just alphabetical
    const aTitleClean = a.title.replace(/[~-]/g, '');
    const bTitleClean = b.title.replace(/[~-]/g, '');
    return aTitleClean.localeCompare(bTitleClean);
  }

  try {
    const aTitleClean = a.id.split('/')[1].replace(/[~-]/g, '');
    const bTitleClean = b.id.split('/')[1].replace(/[~-]/g, '');
    return aTitleClean.localeCompare(bTitleClean);
  } catch (e) {
    return 0;
  }
}
