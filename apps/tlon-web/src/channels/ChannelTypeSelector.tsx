import cn from 'classnames';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import BubbleIcon from '@/components/icons/BubbleIcon';
import NotebookIcon from '@/components/icons/NotebookIcon';
import ShapesIcon from '@/components/icons/ShapesIcon';
import { ChannelType, NewChannelFormSchema } from '@/types/groups';

interface ChannelTypeMetadata {
  title: string;
  icon: React.ReactElement;
  description: string;
  color: string;
}

const CHANNEL_TYPE: Record<ChannelType, ChannelTypeMetadata> = {
  chat: {
    icon: <BubbleIcon className="h-6 w-6 text-gray-600" />,
    title: 'Chat',
    description: 'A simple, standard text chat',
    color: 'bg-blue-soft',
  },
  heap: {
    icon: <ShapesIcon className="h-6 w-6 text-gray-600" />,
    title: 'Gallery',
    description: 'Gather, connect, and arrange rich media',
    color: 'bg-green-soft',
  },
  diary: {
    icon: <NotebookIcon className="h-6 w-6 text-gray-600" />,
    title: 'Notebook',
    description: 'Longform publishing and discussion',
    color: 'bg-red-soft',
  },
};

interface ChannelTypeSelectionProps {
  type: ChannelType;
}

function ChannelTypeSelection({ type }: ChannelTypeSelectionProps) {
  const { title, description, icon, color } = CHANNEL_TYPE[type];
  const { register, watch } = useFormContext<NewChannelFormSchema>();
  const selected = type === watch('type');

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between rounded-lg p-2',
        selected ? color : 'bg-white'
      )}
    >
      <div className="flex w-full flex-col">
        <div className="flex flex-row items-center space-x-2">
          <div
            className={cn(
              'rounded p-2 mix-blend-multiply dark:mix-blend-screen',
              color
            )}
          >
            {icon}
          </div>
          <div className="flex w-full flex-col justify-start text-left">
            <span className="font-semibold">{title}</span>
            <span className="text-sm font-medium text-gray-600">
              {description}
            </span>
          </div>
        </div>
      </div>
      <input
        {...register('type', { required: false })}
        className="sr-only"
        type="radio"
        value={type}
      />
    </label>
  );
}

interface ChannelTypeSelectorProps {
  className?: string;
}

export default function ChannelTypeSelector({
  className,
}: ChannelTypeSelectorProps) {
  return (
    <ul className={cn('flex flex-col space-y-2', className)}>
      {Object.keys(CHANNEL_TYPE).map((ch) => (
        <li key={ch}>
          <ChannelTypeSelection type={ch as ChannelType} />
        </li>
      ))}
    </ul>
  );
}
