import * as db from '@tloncorp/shared/db';
import React, { useMemo } from 'react';

import { useCalm } from '../contexts/appDataContext';
import * as utils from '../utils';
import {
  AvatarFrame,
  AvatarProps,
  GroupImageShim,
  ImageAvatar,
  TextAvatar,
} from './Avatar';
import { FacePile } from './FacePile/FacePile';

const SMALL_AVATAR_SIZES = ['$xl', '$2xl', '$3xl', '$3.5xl'] as const;

function isGroupImageShim(
  group: db.Group | GroupImageShim
): group is GroupImageShim {
  return !('description' in group);
}

export const GroupAvatar = React.memo(function GroupAvatarComponent({
  model,
  memberCount,
  membersLayout = 'default',
  ...props
}: {
  model: db.Group | GroupImageShim;
  memberCount?: number;
  membersLayout?: 'default' | 'compact';
} & AvatarProps) {
  const { disableNicknames } = useCalm();
  const fallbackTitle = useMemo(() => {
    return isGroupImageShim(model)
      ? model.title
      : utils.getGroupTitle(model, disableNicknames);
  }, [disableNicknames, model]);

  const memberContactIds = useMemo(() => {
    if (isGroupImageShim(model)) {
      return [];
    }
    return model.members?.map((m) => m.contactId) ?? [];
  }, [model]);

  const isSmallSize = SMALL_AVATAR_SIZES.includes(
    (props.size ?? '$4xl') as (typeof SMALL_AVATAR_SIZES)[number]
  );
  const facePileGridDensity =
    membersLayout === 'compact' ? 'compact' : 'default';

  const textFallback = (
    <TextAvatar
      text={fallbackTitle ?? 'G'}
      backgroundColor={model.iconImageColor ?? undefined}
      {...props}
    />
  );

  const fallback =
    memberContactIds.length > 0 ? (
      isSmallSize ? (
        <FacePile
          contactIds={memberContactIds}
          maxVisible={2}
          totalCount={memberCount}
        />
      ) : (
        <AvatarFrame
          {...props}
          alignItems="center"
          justifyContent="center"
          backgroundColor="$secondaryBackground"
        >
          <FacePile
            contactIds={memberContactIds}
            maxVisible={4}
            totalCount={memberCount}
            grid
            gridDensity={facePileGridDensity}
          />
        </AvatarFrame>
      )
    ) : (
      textFallback
    );

  return (
    <ImageAvatar
      imageUrl={model.iconImage ?? undefined}
      fallback={fallback}
      isGroupIcon={true}
      {...props}
    />
  );
});
