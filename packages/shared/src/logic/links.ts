import { Profile, SocialLinks, TYPE_DESKTOP, TYPE_MOBILE } from 'social-links';

import * as domain from '../domain';

const twitterProfile: Profile = {
  name: 'twitter',
  matches: [
    {
      // New x.com format
      match: '(https?://)?(www.)?x.com/({PROFILE_ID})',
      group: 3,
      type: TYPE_DESKTOP,
      pattern: 'https://x.com/{PROFILE_ID}',
    },
    {
      // Old twitter.com desktop format
      match: '(https?://)?(www.)?twitter.com/({PROFILE_ID})',
      group: 3,
      type: TYPE_DESKTOP,
      pattern: 'https://x.com/{PROFILE_ID}', // Convert to new x.com format
    },
    {
      // Twitter mobile format
      match: '(https?://)?(www.)?twitter.com/mobile/({PROFILE_ID})',
      group: 3,
      type: TYPE_MOBILE,
      pattern: 'https://x.com/{PROFILE_ID}', // Convert to new x.com format
    },
    {
      // Handle raw username input
      match: '({PROFILE_ID})',
      group: 1,
    },
  ],
};

const youtubeProfile: Profile = {
  name: 'youtube',
  matches: [
    {
      // Full channel URL
      match: '(https?://)?(www.)?youtube.com/channel/({PROFILE_ID})',
      group: 3,
      type: TYPE_DESKTOP,
      pattern: 'https://youtube.com/channel/{PROFILE_ID}',
    },
    {
      // Custom channel URL
      match: '(https?://)?(www.)?youtube.com/c/({PROFILE_ID})',
      group: 3,
      type: TYPE_DESKTOP,
      pattern: 'https://youtube.com/c/{PROFILE_ID}',
    },
    {
      // User URL
      match: '(https?://)?(www.)?youtube.com/@({PROFILE_ID})',
      group: 3,
      type: TYPE_DESKTOP,
      pattern: 'https://youtube.com/@{PROFILE_ID}',
    },
    {
      match: '({PROFILE_ID})',
      group: 1,
    },
  ],
};

const instagramProfile: Profile = {
  name: 'instagram',
  matches: [
    {
      match: '(https?://)?(www.)?instagram.com/({PROFILE_ID})/?',
      group: 3,
      type: TYPE_DESKTOP,
      pattern: 'https://instagram.com/{PROFILE_ID}',
    },
    {
      // Mobile format
      match: '(https?://)?(www.)?instagram.com/mobile/({PROFILE_ID})/?',
      group: 3,
      type: TYPE_MOBILE,
      pattern: 'https://instagram.com/{PROFILE_ID}',
    },
    {
      match: '({PROFILE_ID})',
      group: 1,
    },
  ],
};

const tiktokProfile: Profile = {
  name: 'tiktok',
  matches: [
    {
      match: '(https?://)?(www.)?tiktok.com/@({PROFILE_ID})/?',
      group: 3,
      type: TYPE_DESKTOP,
      pattern: 'https://tiktok.com/@{PROFILE_ID}',
    },
    {
      // VM.TikTok format (short links)
      match: '(https?://)?(vm.)?tiktok.com/({PROFILE_ID})/?',
      group: 3,
      type: TYPE_DESKTOP,
      pattern: 'https://tiktok.com/@{PROFILE_ID}',
    },
    {
      match: '({PROFILE_ID})',
      group: 1,
    },
  ],
};

const soundcloudProfile: Profile = {
  name: 'soundcloud',
  matches: [
    {
      match: '(https?://)?(www.)?soundcloud.com/({PROFILE_ID})/?',
      group: 3,
      type: TYPE_DESKTOP,
      pattern: 'https://soundcloud.com/{PROFILE_ID}',
    },
    {
      // Mobile format
      match: '(https?://)?(m.)?soundcloud.com/({PROFILE_ID})/?',
      group: 3,
      type: TYPE_MOBILE,
      pattern: 'https://soundcloud.com/{PROFILE_ID}',
    },
    {
      match: '({PROFILE_ID})',
      group: 1,
    },
  ],
};

const CUSTOM_PROFILES = [
  twitterProfile,
  youtubeProfile,
  instagramProfile,
  tiktokProfile,
  soundcloudProfile,
];

const socialParser = new SocialLinks({ usePredefinedProfiles: false });
for (const profile of CUSTOM_PROFILES) {
  socialParser.addProfile(profile.name, profile.matches);
}

export function parseSocialLink(link: string): domain.ProfileLink | null {
  const socialType = socialParser.detectProfile(link);
  const socialId = socialType
    ? socialParser.getProfileId(socialType, link)
    : '';
  if (socialType && socialId) {
    const sanitizedLink = socialParser.sanitize(socialType, link);
    return {
      url: sanitizedLink,
      socialPlatformId: socialType as domain.SocialPlatormId,
      socialUserId: socialId,
    };
  }
  return null;
}
