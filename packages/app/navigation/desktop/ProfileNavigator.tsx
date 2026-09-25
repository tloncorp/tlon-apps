import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { NavigationState } from '@react-navigation/routers';
import { View, getVariableValue, useTheme } from '@tamagui/core';
import { AnalyticsEvent, trackEvent } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';

import { AddContactsScreen } from '../../features/contacts/AddContactsScreen';
import { AttestationScreen } from '../../features/profile/AttestationScreen';
import { EditProfileScreen } from '../../features/settings/EditProfileScreen';
import { UserProfileScreen } from '../../features/top/UserProfileScreen';
import { useInviteSystemContactHandler } from '../../hooks/useInviteSystemContactHandler';
import { useMarkMatchesSeen } from '../../hooks/useMarkMatchesSeen';
import {
  ContactsScreenView,
  DESKTOP_SIDEBAR_WIDTH,
  ScreenHeader,
  getDisplayName,
  isWeb,
  useInviteSystemContacts,
} from '../../ui';
import { ProfileDrawerParamList } from '../types';
import {
  ListPaneSafeArea,
  detailPaneScreenLayout,
} from './PaneSafeAreaProvider';

const ProfileDrawer = createDrawerNavigator<ProfileDrawerParamList>();

function DrawerContent(props: DrawerContentComponentProps) {
  const state = props.state as NavigationState<ProfileDrawerParamList>;
  const { navigate } = props.navigation;
  const focusedRoute = state.routes[props.state.index];

  const { data: userContacts } = store.useUserContacts();
  const { data: suggestions } = store.useSuggestedContacts();
  const { data: systemContacts } = store.useSystemContacts();
  const systemContactsWithoutContactId = useMemo(
    () => systemContacts?.filter((contact) => !contact.contactId),
    [systemContacts]
  );
  const inviteSystemContacts = useInviteSystemContacts();
  const inviteLink = db.personalInviteLink.useValue();
  const handleInviteSystemContact = useInviteSystemContactHandler(
    inviteSystemContacts,
    inviteLink
  );

  useMarkMatchesSeen();

  const onContactPress = useCallback(
    (contact: db.Contact) => {
      trackEvent(AnalyticsEvent.ContactProfileSelected);
      navigate('UserProfile', { userId: contact.id });
    },
    [navigate]
  );

  const onAddContact = useCallback((contact: db.Contact) => {
    store.addContact(contact.id);
  }, []);

  const onContactLongPress = useCallback((contact: db.Contact) => {
    if (!isWeb && contact.isContactSuggestion) {
      Alert.alert(`Add ${getDisplayName(contact)}?`, '', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Add Contact',
          style: 'default',
          onPress: () => {
            store.addContact(contact.id);
          },
        },
        {
          text: 'Decline Suggestion',
          style: 'destructive',
          onPress: () => {
            store.removeContactSuggestion(contact.id);
          },
        },
      ]);
    }
  }, []);

  return (
    <View height="100%">
      <ScreenHeader
        title="Contacts"
        rightControls={
          <ScreenHeader.IconButton
            type="Add"
            testID="ContactsAddButton"
            onPress={() => navigate('AddContacts')}
          />
        }
      />
      <ContactsScreenView
        contacts={userContacts ?? []}
        suggestions={suggestions ?? []}
        focusedContactId={
          focusedRoute.params && 'userId' in focusedRoute.params
            ? focusedRoute.params.userId
            : undefined
        }
        onContactPress={onContactPress}
        onAddContact={onAddContact}
        onContactLongPress={onContactLongPress}
        systemContacts={systemContactsWithoutContactId ?? []}
        onInviteSystemContact={handleInviteSystemContact}
      />
    </View>
  );
}

export const ProfileNavigator = () => {
  return (
    <ProfileDrawer.Navigator
      initialRouteName="UserProfile"
      drawerContent={(props) => (
        <ListPaneSafeArea>
          <DrawerContent {...props} />
        </ListPaneSafeArea>
      )}
      screenLayout={detailPaneScreenLayout}
      screenOptions={{
        headerShown: false,
        drawerType: 'permanent',
        drawerStyle: {
          width: DESKTOP_SIDEBAR_WIDTH,
          backgroundColor: getVariableValue(useTheme().background),
          borderRightColor: getVariableValue(useTheme().border),
        },
      }}
      id="ProfileDrawer"
      backBehavior="history"
    >
      <ProfileDrawer.Screen name="AddContacts" component={AddContactsScreen} />
      <ProfileDrawer.Screen name="UserProfile" component={UserProfileScreen} />
      <ProfileDrawer.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileDrawer.Screen name="Attestation" component={AttestationScreen} />
    </ProfileDrawer.Navigator>
  );
};
