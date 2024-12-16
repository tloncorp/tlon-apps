export interface ProfileLink {
  url: string;
  title?: string;
  meta?: {
    description?: string;
    image?: string;
  };
  socialPlatformId?: SocialPlatormId;
  socialUserId?: string;
}

export enum SocialPlatormId {
  Instagram = 'instagram',
  Twitter = 'twitter',
  Facebook = 'facebook',
  LinkedIn = 'linkedin',
  YouTube = 'youtube',
  TikTok = 'tiktok',
  SoundCloud = 'soundcloud',
}
