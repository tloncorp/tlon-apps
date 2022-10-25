import React from 'react';
import { useFormContext } from 'react-hook-form';
import { ChannelFormSchema, ChannelPrivacyType } from '@/types/groups';

interface ChannelPrivacySetting {
  title: string;
  description: string;
  readerSects: string[];
  writerSects: string[];
}

export const PRIVACY_TYPE: Record<ChannelPrivacyType, ChannelPrivacySetting> = {
  public: {
    title: 'Open to All',
    description: 'Anyone can view and write',
    readerSects: ['all'],
    writerSects: ['all'],
  },
  'read-only': {
    title: 'Members Can View',
    description: 'Members can only view',
    readerSects: ['all'],
    writerSects: ['admin'],
  },
  secret: {
    title: 'Admin Only',
    description: 'Only Admin can view and write',
    readerSects: ['admin'],
    writerSects: ['admin'],
  },
};

interface PrivacySettingRowProps {
  type: ChannelPrivacyType;
}

function PrivacySettingRow({ type }: PrivacySettingRowProps) {
  const { title, description } = PRIVACY_TYPE[type];
  const { register, watch } = useFormContext<ChannelFormSchema>();
  const selected = type === watch('privacy');

  return (
    <label
      className={
        'flex cursor-pointer items-center justify-between space-x-2 py-2'
      }
    >
      <div className="flex items-center">
        {selected ? (
          <div className="h-4 w-4 rounded-xl border-4 border-gray-400" />
        ) : (
          <div className="h-4 w-4 rounded-xl border-2 border-gray-200" />
        )}
      </div>
      <div className="flex w-full flex-col">
        <div className="flex flex-row items-center space-x-2">
          <div className="flex w-full flex-col justify-start text-left">
            <span className="font-semibold">{title}</span>
            <span className="text-sm font-medium text-gray-600">
              {description}
            </span>
          </div>
        </div>
      </div>
      <input
        {...register('privacy', { required: false })}
        className="sr-only"
        type="radio"
        value={type}
      />
    </label>
  );
}

export default function PrivacySelector() {
  return (
    <ul className="flex flex-col space-y-2">
      {Object.keys(PRIVACY_TYPE).map((privType) => (
        <li key={privType}>
          <PrivacySettingRow type={privType as ChannelPrivacyType} />
        </li>
      ))}
    </ul>
  );
}
