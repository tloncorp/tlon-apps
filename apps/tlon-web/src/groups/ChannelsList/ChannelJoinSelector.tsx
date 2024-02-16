import CheckIcon from '@/components/icons/CheckIcon';
import { ChannelFormSchema } from '@/types/groups';
import React from 'react';
import { useFormContext } from 'react-hook-form';

export default function ChannelJoinSelector() {
  const { register, watch } = useFormContext<ChannelFormSchema>();
  const selected = watch('join') === true;

  return (
    <label
      className={
        'flex cursor-pointer items-center justify-between space-x-2 py-2'
      }
    >
      <div className="flex items-center">
        {selected ? (
          <div className="flex h-4 w-4 items-center rounded-sm border-2 border-gray-400">
            <CheckIcon className="h-3 w-3 fill-gray-400" />
          </div>
        ) : (
          <div className="h-4 w-4 rounded-sm border-2 border-gray-200" />
        )}
      </div>

      <div className="flex w-full flex-col">
        <div className="flex flex-row items-center space-x-2">
          <div className="flex w-full flex-col justify-start text-left">
            <span className="font-semibold">Default</span>
            <span className="text-sm font-medium text-gray-600">
              New members will be automatically subscribed to this channel
            </span>
          </div>
        </div>
      </div>

      <input
        {...register('join', { required: false })}
        className="sr-only"
        type="checkbox"
      />
    </label>
  );
}
