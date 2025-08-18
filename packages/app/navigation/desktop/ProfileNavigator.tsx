import {
  DrawerContentComponentProps,
  createDrawerNavigator,
} from '@react-navigation/drawer';
import { NavigationState } from '@react-navigation/routers';
import { View, getVariableValue, useTheme } from '@tamagui/core';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { AddContactsScreen } from '../../features/contacts/AddContactsScreen';
import { AttestationScreen } from '../../features/profile/AttestationScreen';
import { EditProfileScreen } from '../../features/settings/EditProfileScreen';
import { UserProfileScreen } from '../../features/top/UserProfileScreen';
import {
  ContactsScreenView,
  DESKTOP_SIDEBAR_WIDTH,
  ScreenHeader,
  getDisplayName,
  isWeb,
} from '../../ui';
import { ProfileDrawerParamList } from '../types';

const ProfileDrawer = createDrawerNavigator();

function DrawerContent(props: DrawerContentComponentProps) {
  const state = props.state as NavigationState<ProfileDrawerParamList>;
  const { navigate } = props.navigation;
  const focusedRoute = state.routes[props.state.index];

  const { data: userContacts } = store.useUserContacts();
  const { data: suggestions } = store.useSuggestedContacts();

  const onContactPress = useCallback(
    (contact: db.Contact) => {
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
        borderBottom
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
        focusedContactId={focusedRoute.params?.userId}
        onContactPress={onContactPress}
        onAddContact={onAddContact}
        onContactLongPress={onContactLongPress}
        systemContacts={[]}
        onInviteSystemContact={() => {}}
      />
    </View>
  );
}

export const ProfileNavigator = () => {
  return (
    <ProfileDrawer.Navigator
      initialRouteName="UserProfile"
      drawerContent={DrawerContent}
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
