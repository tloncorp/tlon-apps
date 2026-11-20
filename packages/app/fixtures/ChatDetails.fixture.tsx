import type * as db from '@tloncorp/shared/db';
import type { ComponentProps } from 'react';

import { ChatDetailsScreenView } from '../ui/components/ChatDetailsScreenView';
import { NativeScreenFixture } from './NativeScreenFixture';
import {
  danContact,
  galenContact,
  group,
  groupWithImage,
  hostedBotContact,
  tlonLocalIntros,
} from './fakeData';

const noop = () => {};

// The app's groups come from the database with each member's standing set.
export const gardenClub: db.Group = {
  ...group,
  title: 'Garden Club',
  description: 'Notes, photos and plans for the allotment. We meet on Sundays.',
  privacy: 'private',
  // A hosted image: the avatar's image check turns down localhost URLs, so
  // a bundled asset served by Metro never shows.
  iconImage: groupWithImage.iconImage,
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
        onPressWorkspace={noop}
        onPressProfile={noop}
        onPressMember={noop}
        onPressAllMembers={noop}
        onLeave={noop}
        onDelete={noop}
        {...props}
      />
    </NativeScreenFixture>
  );
}

const generalChannel: db.Channel = {
  ...tlonLocalIntros,
  groupId: gardenClub.id,
  group: gardenClub,
  title: 'general',
  description: 'Day-to-day chat for everyone in the garden club.',
};

const designCrit: db.Channel = {
  ...tlonLocalIntros,
  lastPost: null,
  lastPostId: null,
  description: null,
  id: '0v4.00000.qcas9.qndoa.7loa7.loa7l',
  type: 'groupDm',
  title: 'Design crit',
  groupId: null,
  currentUserIsMember: true,
  members: [danContact, galenContact, hostedBotContact].map((contact) => ({
    chatId: '0v4.00000.qcas9.qndoa.7loa7.loa7l',
    contactId: contact.id,
    membershipType: 'channel' as const,
    status: 'joined' as const,
    contact,
  })),
};

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
  '8 · Channel, as an admin': (
    <Details
      chatType="channel"
      channel={generalChannel}
      onForwardChannel={noop}
      onCopyChannelLink={noop}
    />
  ),
  '9 · Channel, as a member': (
    <Details
      chatType="channel"
      channel={generalChannel}
      currentUserIsAdmin={false}
      scheduledTaskCount={1}
      onForwardChannel={noop}
      onCopyChannelLink={noop}
    />
  ),
  '10 · Group chat': (
    <Details
      chatType="channel"
      group={null}
      channel={designCrit}
      currentUserIsAdmin={false}
    />
  ),
};
