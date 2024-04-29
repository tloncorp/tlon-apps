import * as db from '@tloncorp/shared/dist/db';

import { SizableText, View } from '../core';

interface Props {
  profile: db.Contact | null;
  currentUserId: string;
}

export function ProfileScreenView(props: Props) {
  return (
    <View>{props.profile && <ProfilePreview profile={props.profile} />}</View>
  );
}

function ProfilePreview({ profile }: { profile: db.Contact }) {
  return (
    <SizableText>
      {profile.nickname} {profile.avatarImage} {profile.coverImage}
    </SizableText>
  );
}
