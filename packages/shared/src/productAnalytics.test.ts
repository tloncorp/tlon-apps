import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDebugStore } from './debug';
import { AnalyticsEvent } from './domain';
import {
  contentHasMentions,
  getContentTelemetryKind,
  getCountTelemetryBucket,
  getSearchResultTelemetryBucket,
  getVoiceMemoDurationBucket,
  trackProductEvent,
} from './productAnalytics';

describe('trackProductEvent', () => {
  afterEach(() => {
    useDebugStore.setState({ errorLogger: null });
  });

  it('adds the schema version without debug-log properties', () => {
    const capture = vi.fn();
    useDebugStore.getState().initializeErrorLogger({ capture });

    trackProductEvent(AnalyticsEvent.HomeFilterSelected, {
      tab: 'groups',
      previousTab: 'all',
      source: 'tap',
      wasAlreadyActive: false,
    });

    expect(capture).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledWith(AnalyticsEvent.HomeFilterSelected, {
      schemaVersion: 1,
      tab: 'groups',
      previousTab: 'all',
      source: 'tap',
      wasAlreadyActive: false,
    });
  });

  it('keeps the richer product events separate from legacy event names', () => {
    expect(AnalyticsEvent.ChatListItemSelected).not.toBe(
      AnalyticsEvent.ActionTappedChat
    );
    expect(AnalyticsEvent.GroupChannelSelected).not.toBe(
      AnalyticsEvent.ActionGroupChannelSelected
    );
    expect(AnalyticsEvent.ActivityDestinationSelected).not.toBe(
      AnalyticsEvent.ActionSelectActivityEvent
    );
    expect(AnalyticsEvent.MediaPlaybackStarted).not.toBe(
      AnalyticsEvent.VideoPlaybackStarted
    );

    expect(AnalyticsEvent.ActionTappedChat).toBe('Tapped Chatlist Item');
    expect(AnalyticsEvent.ActionGroupChannelSelected).toBe(
      'Tapped group channel'
    );
    expect(AnalyticsEvent.ActionSelectActivityEvent).toBe(
      'Tapped Activity Event'
    );
    expect(AnalyticsEvent.VideoPlaybackStarted).toBe('Video Playback Started');
  });

  it('keeps every new feature-usage event name unique', () => {
    const events = [
      AnalyticsEvent.ThreadOpened,
      AnalyticsEvent.GalleryPostOpened,
      AnalyticsEvent.NotebookPostOpened,
      AnalyticsEvent.MediaOpened,
      AnalyticsEvent.ExternalLinkOpened,
      AnalyticsEvent.ContentSendCompleted,
      AnalyticsEvent.PostEditCompleted,
      AnalyticsEvent.AttachmentAdded,
      AnalyticsEvent.VoiceMemoSent,
      AnalyticsEvent.ChannelSearchOpened,
      AnalyticsEvent.SearchPerformed,
      AnalyticsEvent.ChatOptionsOpened,
      AnalyticsEvent.NotificationLevelChanged,
      AnalyticsEvent.ChatMarkedRead,
      AnalyticsEvent.ChannelSortChanged,
      AnalyticsEvent.PinnedChatsReordered,
      AnalyticsEvent.PostPinned,
      AnalyticsEvent.PostUnpinned,
      AnalyticsEvent.ThreadMuted,
      AnalyticsEvent.ThreadUnmuted,
      AnalyticsEvent.PostReported,
      AnalyticsEvent.OnboardingStarted,
      AnalyticsEvent.OnboardingPathSelected,
      AnalyticsEvent.AccountCreated,
      AnalyticsEvent.OnboardingStepCompleted,
      AnalyticsEvent.OnboardingCompleted,
      AnalyticsEvent.OnboardingFailed,
      AnalyticsEvent.LoginCompleted,
      AnalyticsEvent.InviteSurfaceOpened,
      AnalyticsEvent.InviteShareCompleted,
      AnalyticsEvent.InviteOpened,
      AnalyticsEvent.InviteRedeemed,
      AnalyticsEvent.GroupInvitationsSent,
      AnalyticsEvent.GroupCreationCompleted,
      AnalyticsEvent.ChannelCreationCompleted,
      AnalyticsEvent.ProfileUpdateCompleted,
      AnalyticsEvent.ForwardCompleted,
      AnalyticsEvent.NotificationPreferenceChanged,
      AnalyticsEvent.PrivacyPreferenceChanged,
      AnalyticsEvent.AccountSwitched,
      AnalyticsEvent.LogoutCompleted,
      AnalyticsEvent.BugReportSubmitted,
      AnalyticsEvent.ContactDiscoveryCompleted,
      AnalyticsEvent.ProfileOpened,
    ];

    expect(new Set(events).size).toBe(events.length);
    expect(events).not.toContain(AnalyticsEvent.ActionTappedChat);
    expect(events).not.toContain(AnalyticsEvent.InviteShared);
    expect(events).not.toContain(AnalyticsEvent.UserLoggedIn);
  });
});

describe('privacy-safe product analytics helpers', () => {
  it.each([
    [-1, '0'],
    [0, '0'],
    [1, '1'],
    [5, '2-5'],
    [6, '6+'],
  ])('buckets a count of %s as %s', (count, expected) => {
    expect(getCountTelemetryBucket(count)).toBe(expected);
  });

  it.each([
    [0, '0'],
    [1, '1-5'],
    [6, '6-20'],
    [21, '21+'],
  ])('buckets %s search results as %s', (count, expected) => {
    expect(getSearchResultTelemetryBucket(count)).toBe(expected);
  });

  it.each([
    [undefined, 'unknown'],
    [14, 'under_15s'],
    [15, '15s_60s'],
    [60, '15s_60s'],
    [61, 'over_60s'],
  ])('buckets a voice memo duration of %s as %s', (duration, expected) => {
    expect(getVoiceMemoDurationBucket(duration)).toBe(expected);
  });

  it('classifies content without returning its text', () => {
    expect(
      getContentTelemetryKind({ content: ['private words'], attachments: [] })
    ).toBe('text');
    expect(
      getContentTelemetryKind({
        content: ['private words'],
        attachments: [{ type: 'image' }],
      })
    ).toBe('mixed');
    expect(getContentTelemetryKind({ content: [], attachments: [] })).toBe(
      'empty'
    );
  });

  it('detects nested mentions without exposing the mentioned user', () => {
    expect(
      contentHasMentions([{ inline: { mention: '~sampel-palnet' } }])
    ).toBe(true);
    expect(contentHasMentions([{ inline: { text: 'hello' } }])).toBe(false);
  });
});
