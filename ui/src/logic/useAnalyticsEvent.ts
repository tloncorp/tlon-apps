import { useEffect } from 'react';
import useGroupPrivacy from './useGroupPrivacy';
import {
  AnalyticsEventName,
  GroupsAnalyticsEvent,
  captureAnalyticsEvent,
  captureGroupsAnalyticsEvent,
} from './analytics';

export const useAnalyticsEvent = (name: AnalyticsEventName) => {
  useEffect(() => {
    captureAnalyticsEvent(name);
  }, [name]);
};

export const useGroupsAnalyticsEvent = ({
  name,
  leaveName,
  groupFlag,
  chFlag,
  channelType,
}: GroupsAnalyticsEvent) => {
  const { privacy, isFetched: isPrivacyFetched } = useGroupPrivacy(groupFlag);

  useEffect(() => {
    if (isPrivacyFetched) {
      captureGroupsAnalyticsEvent({
        name,
        groupFlag,
        chFlag,
        channelType,
        privacy,
      });
    }

    return () => {
      if (leaveName && isPrivacyFetched) {
        captureGroupsAnalyticsEvent({
          name: leaveName,
          groupFlag,
          chFlag,
          channelType,
          privacy,
        });
      }
    };
  }, [
    name,
    leaveName,
    groupFlag,
    chFlag,
    channelType,
    privacy,
    isPrivacyFetched,
  ]);
};
