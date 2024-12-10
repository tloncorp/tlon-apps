export interface InviteLinkMetadata {
  $og_title?: string;
  $og_description?: string;
  $og_image_url?: string;
  $twitter_title?: string;
  $twitter_description?: string;
  $twitter_image_url?: string;
  $twitter_card?: string;
  inviterUserId?: string;
  inviterNickname?: string;
  inviterAvatarImage?: string;
  inviterColor?: string;
  invitedGroupId?: string;
  invitedGroupTitle?: string;
  invitedGroupDescription?: string;
  invitedGroupIconImageUrl?: string;
  invitedGroupiconImageColor?: string;
  inviteType?: 'user' | 'group';
}
