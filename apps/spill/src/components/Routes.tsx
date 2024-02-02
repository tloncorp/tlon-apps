import {NavigationContainer} from '@react-navigation/native';
import React from 'react';
import {FeedStack} from '../utils/navigation';
import {ChannelScreen} from './screens/ChannelScreen';
import {GroupScreen} from './screens/GroupScreen';
import {FeedScreen} from './screens/FeedScreen';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {GroupsScreen} from './screens/GroupsScreen';
import {DMsScreen} from './screens/DMsScreen';
import {ProfileScreen} from './screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const FeedStackScreen = () => (
  <FeedStack.Navigator initialRouteName="Feed">
    <FeedStack.Screen name="Feed" component={FeedScreen} />
    <FeedStack.Screen
      name="Channel"
      component={ChannelScreen}
      options={({route}) => ({title: route.params.channelTitle})}
    />
    <FeedStack.Screen
      name="Group"
      component={GroupScreen}
      options={({route}) => ({title: route.params.groupTitle})}
    />
  </FeedStack.Navigator>
);

export function Routes() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Activity"
        screenOptions={{headerShown: false}}>
        <Tab.Screen name="Groups" component={GroupsScreen} />
        <Tab.Screen name="DMs" component={DMsScreen} />
        <Tab.Screen name="Activity" component={FeedStackScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
