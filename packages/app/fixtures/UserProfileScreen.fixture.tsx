import { faker } from '@faker-js/faker';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { type ReactNode, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useFixtureInput } from 'react-cosmos/client';
import { View, useTheme } from 'tamagui';

import { nativeHeaderPresentationOptions } from '../navigation/nativeHeaderOptions';
import {
  AppDataContextProvider,
  ScreenHeader,
  UserProfileScreenView,
} from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { group, hostedBotContact } from './fakeData';

// The same people and pictures on every load, so screenshots compare.
faker.seed(7);

const FixtureStack = createNativeStackNavigator<{ Surface: undefined }>();

const exampleContacts: Record<string, db.Contact> = {
  base: {
    id: '~solfer-magfed',
    nickname: 'Dan b',
    color: faker.color.rgb(),
    bio: faker.lorem.paragraphs(2),
    avatarImage: faker.image.avatar(),
    coverImage: faker.image.urlLoremFlickr(),
    pinnedGroups: [
      {
        contactId: '~fabled-faster',
        groupId: group.id,
        group,
      },
    ],
  },
  noBio: {
    id: '~fabled-faster',
    nickname: 'É. Urcades',
    color: faker.color.rgb(),
    avatarImage: faker.image.avatar(),
    coverImage: faker.image.urlLoremFlickr(),
    pinnedGroups: [
      {
        contactId: '~fabled-faster',
        groupId: group.id,
        group,
      },
    ],
  },
  empty: {
    id: '~latter-bolden',
  },
  botOwner: {
    id: '~sampel-palnet',
    nickname: 'bill',
    color: faker.color.rgb(),
    status: 'testing onboarding',
    bio: 'tlon corp',
    avatarImage: faker.image.avatar(),
  },
  ownedBot: {
    ...hostedBotContact,
    nickname: 'Tlonbot',
    avatarImage: 'https://picsum.photos/seed/tlonbot/400',
    botInfo: JSON.stringify({ v: 1, harness: 'openclaw', version: '0.19.0' }),
    botLiveness: JSON.stringify({ v: 1, state: 'online' }),
  },
  // Its owner, ~finned-palmer, has no contact record.
  botWithUnknownOwner: {
    id: '~pinser-botter-finned-palmer',
  },
};

const noop = () => {};

function ProfileScreenFixture({
  contactId,
  viewerId,
}: {
  contactId: string;
  /** Who is looking, when not ~zod: the owner, for their own bot. */
  viewerId?: string;
}) {
  const [isCurrentUser] = useFixtureInput('isCurrentUser', false);
  const [userId, setUserId] = useState(contactId);
  const ownsBot = !!viewerId && api.getBotOwnerId(userId) === viewerId;

  return (
    <FullScreen>
      <AppDataContextProvider
        currentUserId={isCurrentUser ? contactId : (viewerId ?? '~zod')}
        contacts={Object.values(exampleContacts)}
      >
        <ProfileSurface>
          <UserProfileScreenView
            userId={userId}
            connectionStatus={{ complete: true, status: 'yes' }}
            onPressGroup={() => {
              console.log('group pressed');
            }}
            onPressUserProfile={setUserId}
            onPressBotSettings={ownsBot ? noop : undefined}
            onPressScheduledTasks={ownsBot ? noop : undefined}
            scheduledTaskCount={ownsBot ? 3 : undefined}
          />
        </ProfileSurface>
      </AppDataContextProvider>
    </FullScreen>
  );
}

/** The profile as the app shows it: the Profile header over the view. */
function ProfileSurface({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View flex={1} backgroundColor={theme.secondaryBackground.val}>
      <ScreenHeader
        title="Profile"
        backgroundColor={theme.secondaryBackground.val}
        backAction={noop}
        placement="navigation"
      />
      {children}
    </View>
  );
}

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <FixtureWrapper fillHeight fillWidth verticalAlign="top">
      <FixtureNavigator>{children}</FixtureNavigator>
    </FixtureWrapper>
  );
}

function FixtureNavigator({ children }: { children: ReactNode }) {
  // The web renderer gives the page no height, so the stack would collapse
  // to its header.
  const { height } = useWindowDimensions();
  // Inside the fixture's theme, so the native title follows dark mode.
  const theme = useTheme();
  return (
    <View style={{ height }} width="100%">
      <FixtureStack.Navigator
        screenOptions={{
          ...nativeHeaderPresentationOptions,
          headerShown: true,
          headerBackVisible: false,
          headerTintColor: theme.primaryText.val,
          headerTitleStyle: { color: theme.primaryText.val },
        }}
      >
        <FixtureStack.Screen name="Surface">
          {() => children}
        </FixtureStack.Screen>
      </FixtureStack.Navigator>
    </View>
  );
}

export default {
  'Full Profile': <ProfileScreenFixture contactId={exampleContacts.base.id} />,
  'Profile without bio': (
    <ProfileScreenFixture contactId={exampleContacts.noBio.id} />
  ),
  'Empty profile': (
    <ProfileScreenFixture contactId={exampleContacts.empty.id} />
  ),
  'Profile with Tlonbot': (
    <ProfileScreenFixture contactId={exampleContacts.botOwner.id} />
  ),
  'Bot profile': (
    <ProfileScreenFixture contactId={exampleContacts.ownedBot.id} />
  ),
  'Your bot profile': (
    <ProfileScreenFixture
      contactId={exampleContacts.ownedBot.id}
      viewerId={exampleContacts.botOwner.id}
    />
  ),
  'Bot profile, owner not met': (
    <ProfileScreenFixture contactId={exampleContacts.botWithUnknownOwner.id} />
  ),
};
