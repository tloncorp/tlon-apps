import {
  Source,
  VolumeLevel,
  VolumeNames,
  getDefaultVolumeOption,
  getLevelFromVolumeMap,
  getVolumeMapFromLevel,
  sourceToString,
} from '@tloncorp/shared/dist/urbit/activity';
import React, { useEffect, useState } from 'react';

import { useVolumeAdjustMutation, useVolumeSettings } from '@/state/activity';
import { useRouteGroup } from '@/state/groups';

import RadioGroup, { RadioGroupOption } from './RadioGroup';

export default function VolumeSetting({ source }: { source: Source }) {
  const groupFlag = useRouteGroup();
  const [value, setValue] = useState<VolumeLevel | ''>('');
  const { data: settings, isLoading } = useVolumeSettings();
  const currentSettings = source ? settings[sourceToString(source)] : null;
  const currentVolume = currentSettings
    ? getLevelFromVolumeMap(currentSettings)
    : null;
  const notSet = !currentVolume && !isLoading;
  const { label, volume } = getDefaultVolumeOption(source, settings, groupFlag);
  const { mutate: setVolume } = useVolumeAdjustMutation();

  const options: RadioGroupOption[] = [
    { label: VolumeNames.medium, value: 'medium' },
    { label: VolumeNames.soft, value: 'soft' },
    { label: VolumeNames.hush, value: 'hush' },
  ];

  if (!('base' in source) && notSet) {
    options.unshift({
      label,
      value: 'default',
      secondaryLabel: `Your default: ${VolumeNames[volume]}`,
    });
  } else if (notSet) {
    options.unshift({ label: VolumeNames.default, value: 'default' });
  }

  options.unshift({ label: VolumeNames.loud, value: 'loud' });

  useEffect(() => {
    if (value === '' && currentVolume && !isLoading) {
      setValue(currentVolume);
    }

    if (value === '' && !currentVolume && !isLoading) {
      setValue('default');
    }
  }, [currentVolume, value, isLoading]);

  useEffect(() => {
    if (
      !(currentVolume === null && value === 'default') &&
      currentVolume !== value &&
      !isLoading
    ) {
      setVolume({
        source: source || { base: null },
        volume: getVolumeMapFromLevel(value === '' ? 'default' : value),
      });
    }
  }, [value, currentVolume, isLoading, source, setVolume]);

  return (
    <RadioGroup
      value={value}
      setValue={setValue as React.Dispatch<React.SetStateAction<string>>}
      options={options}
    />
  );
}
