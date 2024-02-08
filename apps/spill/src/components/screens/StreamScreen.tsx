import {ObjectList} from '@components/ObjectList';
import * as db from '@db';
import {SizableText, Stack} from '@ochre';
import {useNavigation} from '@react-navigation/native';
import {capitalize, commaSeparatedList, pluralize} from '@utils/format';
import {NavigationScreenProps} from '@utils/navigation';
import {useTabSettings} from '@utils/useTabSettings';
import React, {useLayoutEffect, useMemo} from 'react';

export function StreamScreen({route}: NavigationScreenProps<'Activity'>) {
  const settings = useTabSettings(
    route.params.settingsId,
    route.params.settingsIndex,
  );

  const title = useSettingsTitle(settings);
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({title});
  }, [navigation, title]);

  return <StreamScreenView settings={settings} />;
}

function StreamScreenView({settings}: {settings: db.TabSettings | null}) {
  return (
    <Stack flex={1} backgroundColor={'$background'}>
      {settings ? (
        <ObjectList settings={settings} />
      ) : (
        <SizableText>Missing settings</SizableText>
      )}
    </Stack>
  );
}

function useSettingsTitle(settings: db.TabSettings | null) {
  const query = settings?.query;
  return useMemo(() => {
    const entityName = pluralize(3, capitalize(query?.groupBy ?? 'post'));
    const ofTypeText = commaSeparatedList(query?.ofType, 'and');
    const inChannelsText = query?.inChannels?.length
      ? commaSeparatedList(
          query.inChannels.map(c => c.title),
          'and',
        )
      : null;
    const inGroupsText = query?.inGroups?.length
      ? commaSeparatedList(
          query.inGroups.map(c => c.title),
          'and',
        )
      : null;
    const entity = ofTypeText
      ? [capitalize(ofTypeText), entityName].join(' ')
      : inGroupsText || inChannelsText
      ? entityName
      : 'All ' + entityName;
    const scope = commaSeparatedList([inChannelsText, inGroupsText], 'and in');
    return [entity, scope].filter(t => !!t).join(' in ');
  }, [query]);
}
