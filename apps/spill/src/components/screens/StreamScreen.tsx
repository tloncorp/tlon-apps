import {ObjectList} from '@components/ObjectList';
import * as db from '@db';
import {SizableText, Stack} from '@ochre';
import {useNavigation} from '@react-navigation/native';
import React, {useLayoutEffect, useMemo} from 'react';
import {capitalize, pluralize} from '@utils/format';
import {filterEmpty} from '@utils/list';
import {NavigationScreenProps} from '@utils/navigation';
import {useTabSettings} from '@utils/useTabSettings';

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

  return <ActivityScreenView settings={settings} />;
}

function ActivityScreenView({settings}: {settings: db.TabSettings | null}) {
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
    const ofTypeText = textList(query?.ofType, 'and');
    const inChannelsText = query?.inChannels?.length
      ? textList(
          query.inChannels.map(c => c.title),
          'and',
        )
      : null;
    const inGroupsText = query?.inGroups?.length
      ? textList(
          query.inGroups.map(c => c.title),
          'and',
        )
      : null;
    const entity = ofTypeText
      ? [capitalize(ofTypeText), entityName].join(' ')
      : inGroupsText || inChannelsText
      ? entityName
      : 'All ' + entityName;
    const scope = textList([inChannelsText, inGroupsText], 'and in');
    return [entity, scope].filter(t => !!t).join(' in ');
  }, [query]);
}

function textList(
  arr: (string | null | undefined)[] | null | undefined,
  conjunction: string,
) {
  const filtered = arr ? filterEmpty(arr) : null;
  if (!filtered || !filtered.length) {
    return null;
  }
  if (filtered.length === 1) {
    return filtered[0];
  }
  const last = filtered.pop();
  return filtered.join(', ') + ` ${conjunction} ` + last;
}
