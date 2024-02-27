import { useCallback } from 'react';
import { useSelect, useValue } from 'react-cosmos/client';

import Setting from '@/components/Settings/Setting';

export default function SettingFixture() {
  const [on, setOn] = useValue<boolean>('On', { defaultValue: false });
  const [disabled] = useValue('Disabled', { defaultValue: false });
  const [status] = useSelect('Status', {
    options: ['loading', 'error', 'success', 'idle'],
    defaultValue: 'idle',
  });

  const handleToggle = useCallback(() => {
    setOn(!on);
  }, [on, setOn]);

  return (
    <div>
      <Setting
        name="Test Setting"
        on={on}
        disabled={disabled}
        toggle={handleToggle}
        status={status}
      />
    </div>
  );
}
