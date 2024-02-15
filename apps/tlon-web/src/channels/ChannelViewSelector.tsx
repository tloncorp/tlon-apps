import { ChannelFormSchema } from '@/types/groups';
import { useFormContext } from 'react-hook-form';

interface ViewSettingRowProps {
  type: 'grid' | 'list';
}

interface ViewSetting {
  title: string;
  description: string;
}

export const VIEW_TYPE: Record<'grid' | 'list', ViewSetting> = {
  grid: {
    title: 'Grid',
    description: 'View posts as a grid of cards',
  },
  list: {
    title: 'List',
    description: 'View posts as a list of cards',
  },
};

function ViewSettingRow({ type }: ViewSettingRowProps) {
  const { title, description } = VIEW_TYPE[type];
  const { register, watch } = useFormContext<ChannelFormSchema>();
  const selected = type === watch('view');

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
        {...register('view', { required: false })}
        className="sr-only"
        type="radio"
        value={type}
      />
    </label>
  );
}
export default function ChannelViewSelector() {
  return (
    <div className="flex flex-col space-y-4">
      <ul className="flex flex-col space-y-2">
        {Object.keys(VIEW_TYPE).map((type) => (
          <li key={type}>
            <ViewSettingRow type={type as 'list' | 'grid'} />
          </li>
        ))}
      </ul>
    </div>
  );
}
