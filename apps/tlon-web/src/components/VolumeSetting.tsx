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
import React, { useCallback } from 'react';

import { useVolumeAdjustMutation, useVolumeSettings } from '@/state/activity';
import { useRouteGroup } from '@/state/groups';

import RadioGroup, { RadioGroupOption } from './RadioGroup';
import Setting from './Settings/Setting';

export default function VolumeSetting({ source }: { source: Source }) {
  const groupFlag = useRouteGroup();
  const { data: settings, isLoading } = useVolumeSettings();
  const currentSettings = source ? settings[sourceToString(source)] : null;
  const currentVolume = currentSettings
    ? getLevelFromVolumeMap(currentSettings)
    : null;
  const currentUnreads = currentSettings
    ? getUnreadsFromVolumeMap(currentSettings)
    : true;
  const { label, volume } = getDefaultVolumeOption(source, settings, groupFlag);
  const { mutate: setVolume, isLoading: settingVolume } =
    useVolumeAdjustMutation();

  const options: RadioGroupOption[] = [
    { label: NotificationNames.loud, value: 'loud' },
    { label: NotificationNames.medium, value: 'medium' },
    { label: NotificationNames.soft, value: 'soft' },
    { label: NotificationNames.hush, value: 'hush' },
  ];

  if (!('base' in source)) {
    options.unshift({
      label,
      value: 'default',
      secondaryLabel: `Your default: ${NotificationNames[volume]}`,
    });
  }

  const toggle = useCallback(
    (enabled: boolean) => {
      if (currentVolume === null) {
        return;
      }

      setVolume({
        source: source || { base: null },
        volume: getVolumeMap(currentVolume, enabled),
      });
    },
    [source, currentVolume, setVolume]
  );

  const adjust = useCallback(
    (value: NotificationLevel) => {
      setVolume({
        source: source || { base: null },
        volume:
          value === 'default' ? null : getVolumeMap(value, currentUnreads),
      });
    },
    [currentUnreads, source, setVolume]
  );

  return (
    <div className="space-y-4 flex-1 sm:flex-none sm:min-w-[400px]">
      <Setting
        on={currentUnreads}
        name="Show Unread Indicator"
        toggle={toggle}
        disabled={currentVolume === null}
        status={isLoading ? 'loading' : 'idle'}
        labelClassName="font-semibold"
      />
      <RadioGroup
        value={currentVolume || 'default'}
        setValue={adjust as (value: string) => void}
        options={options}
      />
    </div>
  );
}
