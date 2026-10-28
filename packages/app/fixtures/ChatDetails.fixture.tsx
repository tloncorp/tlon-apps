import type * as db from '@tloncorp/shared/db';
import type { ComponentProps } from 'react';
import { Image, Platform } from 'react-native';

import { ChatDetailsScreenView } from '../ui/components/ChatDetailsScreenView';
import { NativeScreenFixture } from './NativeScreenFixture';
import { danContact, group, groupWithImage, tlonLocalIntros } from './fakeData';

const noop = () => {};

// The app's groups come from the database with each member's standing set.
export const gardenClub: db.Group = {
  ...group,
  title: 'Garden Club',
  description: 'Notes, photos and plans for the allotment. We meet on Sundays.',
  privacy: 'private',
  // Metro resolves the asset; the web renderer has no `require`.
  iconImage:
    Platform.OS === 'web'
      ? groupWithImage.iconImage
      : Image.resolveAssetSource(
          require('../ui/assets/raster/welcome_flowers.jpg')
        )?.uri,
  members: group.members?.map((member) => ({
    ...member,
    status: 'joined' as const,
  })),
};

const online = { complete: true, status: 'yes' } as const;

function Details(props: Partial<ComponentProps<typeof ChatDetailsScreenView>>) {
  return (
    <NativeScreenFixture>
      <ChatDetailsScreenView
        chatType="group"
        group={gardenClub}
        currentUserId={danContact.id}
        currentUserIsAdmin
        hostStatus={online}
        roleCount={3}
        onGoBack={noop}
        onPressEdit={noop}
        onPressInvite={noop}
        onMarkRead={noop}
        onTogglePinned={noop}
        onForward={noop}
        onCopyGroupId={noop}
        onCopyText={noop}
        onPressPrivacy={noop}
        onPressRoles={noop}
        onPressChannels={noop}
        onPressNotifications={noop}
        onPressScheduledTasks={noop}
        onPressChannelPermissions={noop}
        onPressProfile={noop}
        onMessageContact={noop}
        onPressMember={noop}
        onPressAllMembers={noop}
        onLeave={noop}
        onDelete={noop}
        {...props}
      />
    </NativeScreenFixture>
  );
}

const longNameGroup: db.Group = {
  ...gardenClub,
  currentUserIsHost: true,
  // Group names are capped at 30 characters where they are edited.
  title: 'Riverside Allotment Society HQ',
  description:
    'Notes, photos and plans for the allotment. We meet on Sundays at ten by the tool shed, rain or shine. Bring gloves, and seedlings to swap if you have any spare. New members are welcome any week.',
};

export default {
  '1 · Group, as its host': (
    <Details group={{ ...gardenClub, currentUserIsHost: true }} />
  ),
  '2 · Group, as a member': <Details currentUserIsAdmin={false} />,
  '3 · No description yet': (
    <Details
      group={{ ...gardenClub, currentUserIsHost: true, description: '' }}
    />
  ),
  '4 · Long name and description': <Details group={longNameGroup} />,
  '5 · Host offline': (
    <Details
      group={{ ...gardenClub, currentUserIsHost: true }}
      hostStatus={{ complete: true, status: 'no-our-planet' }}
    />
  ),
  '6 · No icon image': (
    <Details
      group={{ ...gardenClub, currentUserIsHost: true, iconImage: null }}
    />
  ),
  '7 · With scheduled tasks': (
    <Details
      group={{ ...gardenClub, currentUserIsHost: true }}
      scheduledTaskCount={2}
    />
  ),
  '8 · Channel': (
    <Details
      chatType="channel"
      channel={{
        ...tlonLocalIntros,
        groupId: gardenClub.id,
        description: 'Say hello and tell us what you grow.',
      }}
    />
  ),
};
