import React from 'react';
import { useFormContext } from 'react-hook-form';
import * as Switch from '@radix-ui/react-switch';
import { ChannelFormSchema, ChannelPrivacyType } from '@/types/groups';

export default function ChannelJoinSelector() {
  const { register } = useFormContext<ChannelFormSchema>();

  return (
    <label className="my-2 flex justify-between font-semibold">
      <div className="flex flex-col">
        <div className="font-semibold">Default</div>
        <div className="font-normal text-gray-600">
          Members will join this channel automatically when joining this group
        </div>
      </div>
      <div className="ml-4">
        <Switch.Root {...register('join')} className="switch">
          <Switch.Thumb className="switch-thumb" />
        </Switch.Root>
      </div>
    </label>
  );
}
