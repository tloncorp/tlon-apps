import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type * as db from '@tloncorp/shared/db';
import type { ComponentProps, ReactNode } from 'react';
import { Image, Platform } from 'react-native';

import { nativeHeaderPresentationOptions } from '../navigation/nativeHeaderOptions';
import { AppDataContextProvider } from '../ui';
import { ChatDetailsScreenView } from '../ui/components/ChatDetailsScreenView';
import { FixtureWrapper } from './FixtureWrapper';
import {
  danContact,
  group,
  groupWithImage,
  initialContacts,
  tlonLocalIntros,
} from './fakeData';

const noop = () => {};
const FixtureStack = createNativeStackNavigator<{ Surface: undefined }>();

// The app's groups come from the database with each member's standing set.
const baseGroup: db.Group = {
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
        ).uri,
  members: group.members?.map((member) => ({
    ...member,
    status: 'joined' as const,
  })),
};

const online = { complete: true, status: 'yes' } as const;

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <FixtureWrapper fillHeight fillWidth verticalAlign="top">
      <FixtureStack.Navigator
        screenOptions={{
          ...nativeHeaderPresentationOptions,
          headerShown: true,
          headerBackVisible: false,
        }}
      >
        <FixtureStack.Screen name="Surface">
          {() => (
            <AppDataContextProvider
              currentUserId={danContact.id}
              contacts={initialContacts}
            >
              {children}
            </AppDataContextProvider>
          )}
        </FixtureStack.Screen>
      </FixtureStack.Navigator>
    </FixtureWrapper>
  );
}

function Details(props: Partial<ComponentProps<typeof ChatDetailsScreenView>>) {
  return (
    <FullScreen>
      <ChatDetailsScreenView
        chatType="group"
        group={baseGroup}
        currentUserId={danContact.id}
        currentUserIsAdmin
        hostStatus={online}
        roleCount={3}
        baseVolumeLevel="medium"
        onGoBack={noop}
        onPressEdit={noop}
        onPressInvite={noop}
        onMarkRead={noop}
        onTogglePinned={noop}
        onForward={noop}
        onCopyGroupId={noop}
        onCopyDescription={noop}
        onPressPrivacy={noop}
        onPressRoles={noop}
        onPressChannels={noop}
        onPressNotifications={noop}
        onPressScheduledTasks={noop}
        onPressChannelPermissions={noop}
        onPressProfile={noop}
        onPressMember={noop}
        onPressAllMembers={noop}
        onLeave={noop}
        onDelete={noop}
        {...props}
      />
    </FullScreen>
  );
}

const longNameGroup: db.Group = {
  ...baseGroup,
  currentUserIsHost: true,
  // Group names are capped at 30 characters where they are edited.
  title: 'Riverside Allotment Society HQ',
  description:
    'Notes, photos and plans for the allotment. We meet on Sundays at ten by the tool shed, rain or shine. Bring gloves, and seedlings to swap if you have any spare. New members are welcome any week.',
};

export default {
  '1 · Group, as its host': (
    <Details group={{ ...baseGroup, currentUserIsHost: true }} />
  ),
  '2 · Group, as a member': <Details currentUserIsAdmin={false} />,
  '3 · No description yet': (
    <Details
      group={{ ...baseGroup, currentUserIsHost: true, description: '' }}
    />
  ),
  '4 · Long name and description': <Details group={longNameGroup} />,
  '5 · Host offline': (
    <Details
      group={{ ...baseGroup, currentUserIsHost: true }}
      hostStatus={{ complete: true, status: 'no-our-planet' }}
    />
  ),
  '6 · No icon image': (
    <Details
      group={{ ...baseGroup, currentUserIsHost: true, iconImage: null }}
    />
  ),
  '7 · With scheduled tasks': (
    <Details
      group={{ ...baseGroup, currentUserIsHost: true }}
      scheduledTaskCount={2}
    />
  ),
  '8 · Channel': (
    <Details
      chatType="channel"
      channel={{
        ...tlonLocalIntros,
        groupId: baseGroup.id,
        description: 'Say hello and tell us what you grow.',
      }}
    />
  ),
};
