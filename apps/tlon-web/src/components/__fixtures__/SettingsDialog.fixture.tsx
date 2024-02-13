import SettingsDialog from '@/components/Settings/SettingsDialog';
import { MemoryRouter } from 'react-router';

export default function SettingsDialogFixture() {
  return (
    <div>
      <MemoryRouter>
        <SettingsDialog />
      </MemoryRouter>
    </div>
  );
}
