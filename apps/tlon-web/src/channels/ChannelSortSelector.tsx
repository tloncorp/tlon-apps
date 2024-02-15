import { ChannelFormSchema } from '@/types/groups';
import { useFormContext } from 'react-hook-form';

interface SortSettingRowProps {
  type: 'time' | 'arranged';
}

interface SortSetting {
  title: string;
  description: string;
}

export const SORT_TYPE: Record<'time' | 'arranged', SortSetting> = {
  time: {
    title: 'Time',
    description: 'Sort posts by time, descending',
  },
  arranged: {
    title: 'Arranged',
    description: 'Sort posts by arrangement, then time, descending',
  },
};

function SortSettingRow({ type }: SortSettingRowProps) {
  const { title, description } = SORT_TYPE[type];
  const { register, watch } = useFormContext<ChannelFormSchema>();
  const selected = type === watch('sort');

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
        {...register('sort', { required: false })}
        className="sr-only"
        type="radio"
        value={type}
      />
    </label>
  );
}
export default function ChannelSortSelector() {
  return (
    <div className="flex flex-col space-y-4">
      <ul className="flex flex-col space-y-2">
        {Object.keys(SORT_TYPE).map((type) => (
          <li key={type}>
            <SortSettingRow type={type as 'time' | 'arranged'} />
          </li>
        ))}
      </ul>
    </div>
  );
}
