import { useDebugStore } from './debug';
import { AnalyticsEvent } from './domain';

export type HomeTelemetryFilter = 'all' | 'groups' | 'messages';
export type ChatListTelemetryEntity =
  | 'group'
  | 'channel'
  | 'direct_message'
  | 'group_message';
export type NavigationTelemetryTab =
  | 'home'
  | 'messages'
  | 'activity'
  | 'contacts'
  | 'settings'
  | 'other';
export type CreateTelemetrySource =
  | 'home_header'
  | 'messages_header'
  | 'unknown';
export type NotesTelemetrySource = 'manual' | 'import' | 'unknown';
export type ChannelTelemetryType =
  | 'chat'
  | 'notebook'
  | 'gallery'
  | 'dm'
  | 'groupDm'
  | 'notes';
export type ContentTelemetryKind =
  | 'empty'
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'voice'
  | 'link'
  | 'reference'
  | 'mixed';
export type CountTelemetryBucket = '0' | '1' | '2-5' | '6+';
export type SearchResultTelemetryBucket = '0' | '1-5' | '6-20' | '21+';
export type ChatTelemetryScope =
  | 'group'
  | 'channel'
  | 'dm'
  | 'group_dm'
  | 'thread';

export function getCountTelemetryBucket(count: number): CountTelemetryBucket {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count <= 5) return '2-5';
  return '6+';
}

export function getSearchResultTelemetryBucket(
  count: number
): SearchResultTelemetryBucket {
  if (count <= 0) return '0';
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  return '21+';
}

export function getVoiceMemoDurationBucket(
  durationSeconds?: number
): 'unknown' | 'under_15s' | '15s_60s' | 'over_60s' {
  if (durationSeconds == null) return 'unknown';
  if (durationSeconds < 15) return 'under_15s';
  if (durationSeconds <= 60) return '15s_60s';
  return 'over_60s';
}

export function getContentTelemetryKind({
  content,
  attachments,
}: {
  content: unknown[];
  attachments: Array<{ type: string }>;
}): ContentTelemetryKind {
  const kinds = new Set<Exclude<ContentTelemetryKind, 'empty' | 'mixed'>>();

  for (const attachment of attachments) {
    switch (attachment.type) {
      case 'image':
      case 'video':
      case 'file':
      case 'link':
      case 'reference':
        kinds.add(attachment.type);
        break;
      case 'voicememo':
        kinds.add('voice');
        break;
    }
  }

  const inspect = (value: unknown) => {
    if (typeof value === 'string') {
      if (value.trim() !== '') kinds.add('text');
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(inspect);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const record = value as Record<string, unknown>;
    if ('link' in record) kinds.add('link');
    if ('cite' in record) kinds.add('reference');
    if ('image' in record) kinds.add('image');
    if ('video' in record) kinds.add('video');
    Object.values(record).forEach(inspect);
  };
  content.forEach(inspect);

  if (kinds.size === 0) return 'empty';
  if (kinds.size > 1) return 'mixed';
  return [...kinds][0]!;
}

export function contentHasMentions(content: unknown[]): boolean {
  const inspect = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(inspect);
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return 'mention' in record || Object.values(record).some(inspect);
  };
  return content.some(inspect);
}

export type ProductAnalyticsEventProperties = {
  [AnalyticsEvent.HomeFilterSelected]: {
    tab: HomeTelemetryFilter;
    previousTab: HomeTelemetryFilter;
    source: 'tap' | 'empty_search';
    wasAlreadyActive: boolean;
  };
  [AnalyticsEvent.HomeSearchOpened]: {
    activeFilter: HomeTelemetryFilter;
    presentation: 'inline' | 'global';
    source: 'home_header';
  };
  [AnalyticsEvent.CreateMenuOpened]: {
    activeFilter?: HomeTelemetryFilter;
    presentation: 'sheet' | 'dialog';
    source: CreateTelemetrySource;
  };
  [AnalyticsEvent.CreateOptionSelected]: {
    option:
      | 'direct_message'
      | 'group'
      | 'join_group'
      | 'quick_group'
      | 'group_template';
    source: CreateTelemetrySource;
    stage: 'conversation_type' | 'group_type';
  };
  [AnalyticsEvent.GlobalSearchOpened]: {
    source: 'keyboard_or_header';
  };
  [AnalyticsEvent.GlobalSearchResultSelected]: {
    entityType: ChatListTelemetryEntity;
    hasQuery: boolean;
    source: 'global_search';
  } & Record<string, string | boolean | null>;
  [AnalyticsEvent.ChannelSearchResultSelected]: {
    hasQuery: boolean;
    resultType: 'post' | 'reply';
    source: 'channel_search';
  } & Record<string, string | boolean | null>;
  [AnalyticsEvent.ActivityFilterSelected]: {
    tab: 'all' | 'mentions' | 'replies';
    previousTab: 'all' | 'mentions' | 'replies';
    wasAlreadyActive: boolean;
  };
  [AnalyticsEvent.ActivityMarkedAllRead]: {
    source: 'activity_overflow';
  };
  [AnalyticsEvent.ActivityDestinationSelected]: {
    activeFilter: 'all' | 'mentions' | 'replies';
    destination:
      | 'channel_post'
      | 'thread'
      | 'reaction'
      | 'group_invite'
      | 'profile';
    source: 'activity_list';
  } & Record<string, string | boolean | null>;
  [AnalyticsEvent.ContactProfileSelected]: {
    contactType: 'self' | 'contact' | 'suggestion';
    source: 'contacts_list';
  };
  [AnalyticsEvent.NoteOpened]: {
    presentation: 'split' | 'screen';
    source: 'notes_tree' | 'created_note' | 'rename_action';
  };
  [AnalyticsEvent.GroupChannelSelected]: {
    channelType: ChannelTelemetryType;
    source: 'group_channels';
  } & Record<string, string | boolean | null>;
  [AnalyticsEvent.NoteCreated]: {
    hadInitialBody: boolean;
    source: NotesTelemetrySource;
  };
  [AnalyticsEvent.NoteSaved]: {
    changedBody: boolean;
    changedTitle: boolean;
    source: 'notes_editor';
  };
  [AnalyticsEvent.NoteMoved]: { source: 'notes_tree' };
  [AnalyticsEvent.NotePublished]: { source: 'notes_tree' };
  [AnalyticsEvent.NoteUnpublished]: { source: 'notes_tree' };
  [AnalyticsEvent.NoteDeleted]: { source: 'notes_tree' };
  [AnalyticsEvent.NotesFolderCreated]: { source: NotesTelemetrySource };
  [AnalyticsEvent.NotesFolderOpened]: { source: 'notes_tree' };
  [AnalyticsEvent.NotesFolderRenamed]: { source: 'notes_tree' };
  [AnalyticsEvent.NotesFolderMoved]: { source: 'notes_tree' };
  [AnalyticsEvent.NotesFolderDeleted]: {
    containedFolders: boolean;
    source: 'notes_tree';
  };
  [AnalyticsEvent.MediaDownloaded]: {
    mediaType: 'image' | 'video';
    source: 'media_viewer';
  };
  [AnalyticsEvent.MediaPlaybackStarted]: {
    mediaType: 'video';
    source: 'media_viewer';
  };
  [AnalyticsEvent.ThreadOpened]: {
    channelType: ChannelTelemetryType;
    source:
      | 'post'
      | 'reply_summary'
      | 'search'
      | 'activity'
      | 'pinned_post'
      | 'reference'
      | 'unknown';
  };
  [AnalyticsEvent.GalleryPostOpened]: {
    source: 'gallery_grid' | 'search' | 'activity' | 'reference' | 'unknown';
  };
  [AnalyticsEvent.NotebookPostOpened]: {
    source: 'notebook_list' | 'search' | 'activity' | 'reference' | 'unknown';
  };
  [AnalyticsEvent.MediaOpened]: {
    mediaType: 'image' | 'video';
    source: 'post' | 'profile' | 'media_viewer' | 'unknown';
  };
  [AnalyticsEvent.ExternalLinkOpened]: {
    source: 'post' | 'profile' | 'settings' | 'unknown';
  };
  [AnalyticsEvent.ContentSendCompleted]: {
    attachmentCountBucket: CountTelemetryBucket;
    channelType: ChannelTelemetryType;
    contentKind: ContentTelemetryKind;
    hadMentions: boolean;
    isBotDm: boolean;
    isReply: boolean;
  };
  [AnalyticsEvent.PostEditCompleted]: {
    channelType: ChannelTelemetryType;
    contentKind: ContentTelemetryKind;
    isReply: boolean;
  };
  [AnalyticsEvent.AttachmentAdded]: {
    attachmentTypes: Array<'image' | 'video' | 'file' | 'voice'>;
    countBucket: CountTelemetryBucket;
    source: 'composer' | 'gallery' | 'unknown';
  };
  [AnalyticsEvent.VoiceMemoSent]: {
    channelType: ChannelTelemetryType;
    durationBucket: 'unknown' | 'under_15s' | '15s_60s' | 'over_60s';
    isReply: boolean;
  };
  [AnalyticsEvent.ChannelSearchOpened]: {
    channelType: ChannelTelemetryType;
    source: 'channel_header';
  };
  [AnalyticsEvent.SearchPerformed]: {
    resultCountBucket: SearchResultTelemetryBucket;
    surface: 'home' | 'global' | 'channel';
  };
  [AnalyticsEvent.ChatOptionsOpened]: {
    scope: Exclude<ChatTelemetryScope, 'thread'>;
    source: 'chat_list' | 'channel_header' | 'unknown';
  };
  [AnalyticsEvent.NotificationLevelChanged]: {
    level: string;
    scope: ChatTelemetryScope;
    source: 'chat_options';
  };
  [AnalyticsEvent.ChatMarkedRead]: {
    scope: Exclude<ChatTelemetryScope, 'thread'>;
    source: 'chat_options';
  };
  [AnalyticsEvent.ChannelSortChanged]: {
    sort: 'recency' | 'arrangement';
    source: 'group_options';
  };
  [AnalyticsEvent.PinnedChatsReordered]: {
    itemType: 'group' | 'channel' | 'dm' | 'group_dm';
    source: 'drag';
  };
  [AnalyticsEvent.PostPinned]: {
    channelType: ChannelTelemetryType;
    source: 'post_actions';
  };
  [AnalyticsEvent.PostUnpinned]: {
    channelType: ChannelTelemetryType;
    source: 'post_actions';
  };
  [AnalyticsEvent.ThreadMuted]: {
    channelType: ChannelTelemetryType;
    source: 'post_actions';
  };
  [AnalyticsEvent.ThreadUnmuted]: {
    channelType: ChannelTelemetryType;
    source: 'post_actions';
  };
  [AnalyticsEvent.PostReported]: {
    channelType: ChannelTelemetryType;
    source: 'post_actions';
  };
  [AnalyticsEvent.OnboardingStarted]: {
    entry: 'fresh_install' | 'returning_session' | 'unknown';
  };
  [AnalyticsEvent.OnboardingPathSelected]: {
    path: 'signup' | 'invite' | 'login' | 'connect_ship';
    source: 'welcome';
  };
  [AnalyticsEvent.AccountCreated]: {
    method: 'email' | 'phone';
    hadInvite: boolean;
  };
  [AnalyticsEvent.OnboardingStepCompleted]: {
    step:
      | 'invite'
      | 'signup'
      | 'otp'
      | 'nickname'
      | 'notifications'
      | 'telemetry'
      | 'ship_login';
  };
  [AnalyticsEvent.OnboardingCompleted]: {
    accountType: 'hosted' | 'self_hosted';
  };
  [AnalyticsEvent.OnboardingFailed]: {
    errorCode: string;
    step: string;
  };
  [AnalyticsEvent.LoginCompleted]: {
    accountType: 'hosted' | 'self_hosted';
    method: 'email' | 'phone' | 'access_code' | 'unknown';
  };
  [AnalyticsEvent.InviteSurfaceOpened]: {
    inviteType: 'personal' | 'group';
    source: 'home' | 'group_options' | 'invite_screen' | 'unknown';
  };
  [AnalyticsEvent.InviteShareCompleted]: {
    inviteType: 'personal' | 'group';
    method: 'copy' | 'native_share';
    source: 'invite_surface';
  };
  [AnalyticsEvent.InviteOpened]: {
    inviteType: 'personal' | 'group' | 'unknown';
    source: 'deep_link' | 'paste';
  };
  [AnalyticsEvent.InviteRedeemed]: {
    inviteType: 'personal' | 'group' | 'unknown';
    source: 'deep_link' | 'paste';
  };
  [AnalyticsEvent.GroupInvitationsSent]: {
    countBucket: CountTelemetryBucket;
    source: 'member_picker';
  };
  [AnalyticsEvent.GroupCreationCompleted]: {
    source: 'create_flow';
  };
  [AnalyticsEvent.ChannelCreationCompleted]: {
    channelType: Exclude<ChannelTelemetryType, 'dm' | 'groupDm'>;
    restricted: boolean;
  };
  [AnalyticsEvent.ProfileUpdateCompleted]: {
    changedAvatar: boolean;
    changedBio: boolean;
    changedNickname: boolean;
    changedPinnedGroups: boolean;
    changedStatus: boolean;
  };
  [AnalyticsEvent.ForwardCompleted]: {
    itemType: 'post' | 'group';
    targetChannelType: ChannelTelemetryType;
  };
  [AnalyticsEvent.NotificationPreferenceChanged]: {
    setting: string;
    value: boolean | string;
  };
  [AnalyticsEvent.PrivacyPreferenceChanged]: {
    enabled: boolean;
    setting:
      | 'usage_statistics'
      | 'phone_discovery'
      | 'tlon_helpers'
      | 'nicknames'
      | 'avatars';
  };
  [AnalyticsEvent.AccountSwitched]: {
    source: 'ship_picker';
  };
  [AnalyticsEvent.LogoutCompleted]: {
    source: 'settings' | 'session_expired' | 'unknown';
  };
  [AnalyticsEvent.BugReportSubmitted]: {
    hasAdditionalNotes: boolean;
    source: 'settings';
  };
  [AnalyticsEvent.ContactDiscoveryCompleted]: {
    matchedCountBucket: CountTelemetryBucket;
    source: 'contact_book';
  };
  [AnalyticsEvent.ProfileOpened]: {
    hasChannelContext: boolean;
    hasGroupContext: boolean;
    isSelf: boolean;
    source: 'profile_screen';
  };
  [AnalyticsEvent.NavigationTabSelected]: {
    tab: Exclude<NavigationTelemetryTab, 'other'>;
    previousTab: NavigationTelemetryTab;
    source: 'bottom_navigation' | 'desktop_sidebar';
    wasAlreadyActive: boolean;
  };
  [AnalyticsEvent.ChatListItemSelected]: {
    activeFilter: HomeTelemetryFilter;
    entityType: ChatListTelemetryEntity;
    isSearchResult: boolean;
    itemState: 'joined' | 'pending';
    source: 'home_list' | 'home_sidebar' | 'messages_sidebar';
  } & Record<string, string | boolean | null>;
};

/**
 * Captures intentional product usage without adding debug-log fields to the
 * event. The initialized PostHog client still owns consent and delivery.
 */
export function trackProductEvent<
  Event extends keyof ProductAnalyticsEventProperties,
>(event: Event, properties: ProductAnalyticsEventProperties[Event]) {
  useDebugStore.getState().errorLogger?.capture(event, {
    schemaVersion: 1,
    ...properties,
  });
}
