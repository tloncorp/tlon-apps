import cn from 'classnames';
import { ChannelType, NewChannelFormSchema } from '@/types/groups';
import React from 'react';
import { useFormContext } from 'react-hook-form';
import BubbleIcon from '@/components/icons/BubbleIcon';
import LinkIcon from '@/components/icons/LinkIcon';
import NotebookIcon from '@/components/icons/NotebookIcon';

interface ChannelTypeMetadata {
  title: string;
  icon: React.ReactElement;
  description: string;
}

const CHANNEL_TYPE: Record<ChannelType, ChannelTypeMetadata> = {
  chat: {
    icon: <BubbleIcon className="h-6 w-6 text-gray-600" />,
    title: 'Chat',
    description: 'A simple, standard text chat',
  },
  heap: {
    icon: <LinkIcon className="h-6 w-6 text-gray-600" />,
    title: 'Collection',
    description: 'Gather, connect, and arrange rich media',
  },
  diary: {
    icon: <NotebookIcon className="h-6 w-6 text-gray-600" />,
    title: 'Notebook',
    description: 'Longform publishing and discussion',
  },
};

interface ChannelTypeSelectionProps {
  type: ChannelType;
}

function ChannelTypeSelection({ type }: ChannelTypeSelectionProps) {
  const { title, description, icon } = CHANNEL_TYPE[type];
  const { register, watch } = useFormContext<NewChannelFormSchema>();
  const selected = type === watch('type');

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between rounded-lg border-2 p-2',
        selected ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-white'
      )}
    >
      <div className="flex w-full flex-col">
        <div className="flex flex-row items-center space-x-2">
          <div className="p-2">{icon}</div>
          <div className="flex w-full flex-col justify-start text-left">
            <span className="font-semibold">{title}</span>
            <span className="text-sm font-medium text-gray-600">
              {description}
            </span>
          </div>
        </div>
      </div>
      <input
        {...register('type')}
        className="sr-only"
        type="radio"
        value={type}
      />
      <div className="flex items-center">
        {selected ? (
          <div className="h-4 w-4 rounded-xl border-4 border-gray-400" />
        ) : (
          <div className="h-4 w-4 rounded-xl border-2 border-gray-200" />
        )}
      </div>
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
