import { createDevLogger, logSyncDuration } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import anyAscii from 'any-ascii';
import { useMemo } from 'react';

import { useCalm } from '../contexts';
import * as utils from '../utils';

export type AlphaGroupsSegment = {
  label: string;
  data: db.Group[];
};

export type AlphaSegmentedGroups = AlphaGroupsSegment[];

const logger = createDevLogger('groupSorter', false);

type GroupSegment = { id: string; sortable: string; group: db.Group };

export function useAlphabeticallySegmentedGroups({
  groups,
  enabled,
}: {
  groups: db.Group[];
  enabled?: boolean;
}): AlphaSegmentedGroups {
  const { disableNicknames } = useCalm();
  const segmentedGroups = useMemo(() => {
    if (!enabled) return [];
    return logSyncDuration('useAlphabeticallySegmentedContacts', logger, () => {
      const segmented: Record<string, GroupSegment[]> = {};

      // convert contact to alphabetical representation and bucket by first letter
      for (const group of groups) {
        const sortableName = anyAscii(
          utils.getGroupTitle(group, disableNicknames).replace(/[~-]/g, '')
        );
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
      const segmentedGroups = Object.entries(segmented)
        .filter(([_k, results]) => results.length > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, results]) => {
          const segmentGroups = results.sort(groupsSorter).map((r) => r.group);
          return { label, data: segmentGroups };
        });

      // add non-alphabetical names to the end
      if (nonAlphaNames && nonAlphaNames.length) {
        segmentedGroups.push({
          label: '_',
          data: nonAlphaNames.map((r) => r.group),
        });
      }

      return segmentedGroups;
    });
  }, [disableNicknames, enabled, groups]);

  return segmentedGroups;
}

function groupsSorter(a: GroupSegment, b: GroupSegment): number {
  return a.sortable.localeCompare(b.sortable);
}
