import {
  NotificationLevel,
  NotificationNames,
  Source,
  getDefaultVolumeOption,
  getLevelFromVolumeMap,
  getUnreadsFromVolumeMap,
  getVolumeMap,
  sourceToString,
} from '@tloncorp/shared/dist/urbit/activity';
import React, { useEffect, useState } from 'react';

import { useVolumeAdjustMutation, useVolumeSettings } from '@/state/activity';
import { useRouteGroup } from '@/state/groups';

import RadioGroup, { RadioGroupOption } from './RadioGroup';
import Setting from './Settings/Setting';

export default function VolumeSetting({ source }: { source: Source }) {
  const groupFlag = useRouteGroup();
  const [value, setValue] = useState<NotificationLevel | ''>('');
  const { data: settings, isLoading } = useVolumeSettings();
  const currentSettings = source ? settings[sourceToString(source)] : null;
  const currentVolume = currentSettings
    ? getLevelFromVolumeMap(currentSettings)
    : null;
  const currentUnreads = currentSettings
    ? getUnreadsFromVolumeMap(currentSettings)
    : true;
  const [unreads, setUnreads] = useState(currentUnreads);
  const notSet = !currentVolume && !isLoading;
  const { label, volume } = getDefaultVolumeOption(source, settings, groupFlag);
  const { mutate: setVolume } = useVolumeAdjustMutation();
  console.log(sourceToString(source), currentSettings, settings, source);

  const options: RadioGroupOption[] = [
    { label: NotificationNames.soft, value: 'soft' },
    { label: NotificationNames.hush, value: 'hush' },
  ];

  if (!('base' in source)) {
    options.unshift({
      label,
      value: 'default',
      secondaryLabel: `Your default: ${NotificationNames[volume]}`,
    });
  } else {
    options.unshift({ label: NotificationNames.default, value: 'default' });
  }

  options.unshift({ label: NotificationNames.loud, value: 'loud' });

  useEffect(() => {
    if (value === '' && currentVolume && !isLoading) {
      setValue(currentVolume);
    }

    if (value === '' && !currentVolume && !isLoading) {
      setValue('default');
    }
  }, [currentVolume, value, isLoading]);

  useEffect(() => {
    if (unreads !== currentUnreads && !isLoading) {
      setUnreads(currentUnreads);
    }
  }, [unreads, currentUnreads, isLoading]);

  useEffect(() => {
    if (value === '') {
      return;
    }

    const notVolumeDefault = !(currentVolume === null && value === 'default');
    const volumeNew = currentVolume !== value;
    if (
      ((notVolumeDefault && volumeNew) || unreads !== currentUnreads) &&
      !isLoading
    ) {
      debugger;
      setVolume({
        source: source || { base: null },
        volume: getVolumeMap(value, unreads),
      });
    }
  }, [
    value,
    currentVolume,
    unreads,
    currentUnreads,
    isLoading,
    source,
    setVolume,
  ]);

  return (
    <div className="space-y-4">
      <Setting
        on={unreads}
        name="Show Unread Indicator"
        toggle={setUnreads}
        status={isLoading ? 'loading' : 'idle'}
        labelClassName="font-semibold"
      />
      <RadioGroup
        value={value}
        setValue={setValue as React.Dispatch<React.SetStateAction<string>>}
        options={options}
      />
    </div>
  );
}
