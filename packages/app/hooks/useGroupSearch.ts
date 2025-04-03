import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { whomIsFlag } from '@tloncorp/shared/urbit';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { GroupPreviewAction } from '../ui';
import { useGroupActions } from './useGroupActions';

export default function useGroupSearch(groupCode: string) {
  const [isSearching, setIsSearching] = useState(false);
  const [foundGroup, setFoundGroup] = useState<db.Group | null>(null);
  const [isCodeValid, setIsCodeValid] = useState(false);

  useEffect(() => {
    if (groupCode !== '') {
      const isValidGroupId = whomIsFlag(groupCode);
      if (!isValidGroupId) {
        // Check if it's a group reference format
        const parts = groupCode.split('/');
        const potentialGroupCode = [parts[3], parts[4]].join('/');
        const isValidRef = whomIsFlag(potentialGroupCode);
        setIsCodeValid(isValidRef);
      } else {
        setIsCodeValid(true);
      }
    } else {
      setIsCodeValid(false);
    }
  }, [groupCode]);

  const normalizedCode = useMemo(() => {
    if (!groupCode) return '';

    if (whomIsFlag(groupCode)) {
      return groupCode;
    }

    // Handle reference format
    const parts = groupCode.split('/');
    if (parts.length >= 5) {
      const potentialCode = [parts[3], parts[4]].join('/');
      if (whomIsFlag(potentialCode)) {
        return potentialCode;
      }
    }

    return groupCode;
  }, [groupCode]);

  const {
    data: groupsHostedBy,
    isLoading,
    isError,
    error: errorHostedBy,
  } = store.useGroupsHostedBy(normalizedCode.split('/')[0], !isCodeValid);

  useEffect(() => {
    if (groupsHostedBy && !isLoading && !isError && isSearching) {
      const groupInHostedBy = groupsHostedBy.find(
        (g) => g.id === normalizedCode
      );
      if (groupInHostedBy) {
        setFoundGroup(groupInHostedBy);
      }
    }

    if (isError) {
      setFoundGroup(null);
      console.error('Error fetching group', errorHostedBy);
    }
  }, [
    isLoading,
    isError,
    groupsHostedBy,
    normalizedCode,
    errorHostedBy,
    isSearching,
  ]);

  const { performGroupAction } = useGroupActions();

  const handleGroupAction = useCallback(
    (action: GroupPreviewAction, updatedGroup: db.Group) => {
      performGroupAction(action, updatedGroup);
      setIsSearching(false);
      setFoundGroup(null);
    },
    [performGroupAction]
  );

  const startSearch = useCallback(() => {
    if (isCodeValid) {
      setIsSearching(true);
    }
  }, [isCodeValid]);

  const resetSearch = useCallback(() => {
    setIsSearching(false);
    setFoundGroup(null);
  }, []);

  return {
    isCodeValid,
    normalizedCode,
    state: {
      isSearching,
      isLoading,
      isError,
      group: foundGroup,
    },
    actions: {
      startSearch,
      resetSearch,
      handleGroupAction,
    },
  };
}
