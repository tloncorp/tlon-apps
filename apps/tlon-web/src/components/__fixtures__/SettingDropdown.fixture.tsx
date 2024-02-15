import SettingDropdown from '@/components/Settings/SettingDropdown';
import { useSelect, useValue } from 'react-cosmos/client';

const options = [
  { label: 'First Option', value: 'first' },
  { label: 'Second Option', value: 'second' },
  { label: 'Third Option', value: 'third' },
];

export default function SettingDropdownFixture() {
  const [disabled] = useValue('Disabled', { defaultValue: false });
  const [status] = useSelect('Status', {
    options: ['loading', 'error', 'success', 'idle'],
    defaultValue: 'idle',
  });

  return (
    <div>
      <SettingDropdown
        name={'Test Setting'}
        options={options}
        selected={options[0]}
        disabled={disabled}
        status={status}
        onChecked={() => null}
      />
    </div>
  );
}
