import { MemoryRouter } from 'react-router';

import SettingsDialog from '@/components/Settings/SettingsDialog';

export default function SettingsDialogFixture() {
  return (
    <div>
      <MemoryRouter>
        <SettingsDialog />
      </MemoryRouter>
    </div>
  );
}
