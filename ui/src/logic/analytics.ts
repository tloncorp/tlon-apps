import posthog, { Properties } from 'posthog-js';
import { PrivacyType } from '@/types/groups';
import queryClient from '@/queryClient';
import { SettingsState } from '@/state/settings';
import { isTalk, log } from './utils';
import { isNativeApp } from './native';

export type AnalyticsEventName =
  | 'app_open'
  | 'app_close'
  | 'profile_edit'
  | 'profile_view'
  | 'open_group'
  | 'leave_group'
  | 'open_channel'
  | 'leave_channel'
  | 'react_item'
  | 'comment_item'
  | 'post_item'
  | 'view_item';

export type AnalyticsChannelType = 'chat' | 'diary' | 'heap';

export type GroupsAnalyticsEvent = {
  name: AnalyticsEventName;
  leaveName?: AnalyticsEventName;
  groupFlag: string;
  chFlag?: string;
  channelType?: AnalyticsChannelType;
  privacy?: PrivacyType;
};

// Configure PostHog with all auto-capturing settings disabled,
// as we will only be tracking specific interactions.
posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: 'https://eu.posthog.com',
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  disable_session_recording: true,
  mask_all_text: true,
  mask_all_element_attributes: true,
  opt_out_capturing_by_default: true,
});

export const analyticsClient = posthog;

export const captureAnalyticsEvent = (
  name: AnalyticsEventName,
  properties?: Properties
) => {
  log('Attempting to capture analytics event', name);
  // Do not capture any analytics events for the Talk web or Talk Android
  if (isTalk || isNativeApp()) {
    return;
  }

  // Do not capture any analytics events if the user has opted out
  const settings = queryClient.getQueryData<{ desk: SettingsState }>([
    'settings',
    window.desk,
  ]);
  if (!settings || !settings?.desk?.groups?.logActivity) {
    return;
  }

  const captureProperties: Properties = {
    // The following default properties stop PostHog from auto-logging the URL,
    // which can inadvertently reveal private info on Urbit
    $current_url: null,
    $pathname: null,
    $set_once: null,
    ...(properties || {}),
  };

  log('Capturing analytics event', name, captureProperties);
  posthog.capture(name, captureProperties);
};

export const captureGroupsAnalyticsEvent = ({
  name,
  groupFlag,
  chFlag,
  channelType,
  privacy,
}: GroupsAnalyticsEvent) => {
  if (!privacy || privacy === 'secret') {
    return;
  }

  const properties: Properties = {};

  if (channelType) {
    properties.channel_type = channelType;
  }

  if (privacy === 'public') {
    properties.group_flag = groupFlag;
    if (chFlag) {
      properties.channel_flag = chFlag;
    }
  }

  captureAnalyticsEvent(name, properties);
};
