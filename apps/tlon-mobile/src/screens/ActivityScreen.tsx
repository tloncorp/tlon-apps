import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import * as store from '@tloncorp/shared/dist/store';
import { ActivityScreenView, View } from '@tloncorp/ui';

import NavBarView from '../navigation/NavBarView';
import { TabParamList } from '../types';

type Props = BottomTabScreenProps<TabParamList, 'Activity'>;

export function ActivityScreen(props: Props) {
  const { data: activityEvents } = store.useActivityEvents();

  return (
    <View backgroundColor="$background" flex={1}>
      <ActivityScreenView activityEvents={activityEvents ?? []} />
      <NavBarView navigation={props.navigation} />
    </View>
  );
}
