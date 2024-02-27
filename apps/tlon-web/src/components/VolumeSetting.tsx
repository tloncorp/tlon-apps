import {
  LevelNames,
  Scope,
  VolumeValue,
} from '@tloncorp/shared/dist/urbit/volume';
import React, { useEffect, useState } from 'react';

import {
  useBaseVolumeSetMutation,
  useGroupChannelVolumeSetMutation,
  useGroupVolumeSetMutation,
  useRouteGroup,
  useVolume,
} from '@/state/groups';

import RadioGroup, { RadioGroupOption } from './RadioGroup';

export default function VolumeSetting({ scope }: { scope?: Scope }) {
  const groupFlag = useRouteGroup();
  const [value, setValue] = useState('');
  const { volume: currentVolume, isLoading } = useVolume(scope);
  const { volume: baseVolume, isLoading: baseVolumeIsLoading } = useVolume();
  const { volume: groupVolume, isLoading: groupVolumeIsLoading } = useVolume({
    group: groupFlag,
  });
  const { mutate: setBaseVolume } = useBaseVolumeSetMutation();
  const { mutate: setGroupVoulume } = useGroupVolumeSetMutation();
  const { mutate: setChannelVolume } = useGroupChannelVolumeSetMutation();

  const options: RadioGroupOption[] = [
    { label: LevelNames.loud, value: 'loud' },
    { label: LevelNames.soft, value: 'soft' },
    { label: LevelNames.hush, value: 'hush' },
  ];

  const defaultLevel =
    scope && 'channel' in scope
      ? groupVolume === null
        ? baseVolume
        : groupVolume
      : baseVolume;

  if (scope) {
    options.unshift({
      label:
        'channel' in scope && groupVolume !== null
          ? 'Use group default'
          : 'Use default setting',
      value: 'default',
      secondaryLabel: `Your default: ${
        LevelNames[defaultLevel === null ? 'soft' : defaultLevel]
      }`,
    });
  }

  useEffect(() => {
    if (value === '' && currentVolume && !isLoading) {
      setValue(currentVolume);
    }
    if (
      value === '' &&
      currentVolume == null &&
      baseVolume &&
      !isLoading &&
      !baseVolumeIsLoading
    ) {
      setValue('default');
    }
  }, [
    currentVolume,
    value,
    isLoading,
    scope,
    baseVolume,
    baseVolumeIsLoading,
    groupVolume,
    groupVolumeIsLoading,
  ]);

  useEffect(() => {
    if (value !== '' && currentVolume !== value && !isLoading) {
      if (!scope) {
        setBaseVolume({ volume: value as VolumeValue });
      } else if ('group' in scope) {
        if (value !== 'default') {
          setGroupVoulume({ flag: scope.group, volume: value as VolumeValue });
        } else {
          setGroupVoulume({ flag: scope.group, volume: null });
        }
      } else if ('channel' in scope) {
        if (value !== 'default') {
          setChannelVolume({
            nest: scope.channel,
            volume: value as VolumeValue,
          });
        } else {
          setChannelVolume({
            nest: scope.channel,
            volume: null,
          });
        }
      }
    }
  }, [
    value,
    currentVolume,
    isLoading,
    scope,
    setBaseVolume,
    setGroupVoulume,
    setChannelVolume,
  ]);

  return <RadioGroup value={value} setValue={setValue} options={options} />;
}
