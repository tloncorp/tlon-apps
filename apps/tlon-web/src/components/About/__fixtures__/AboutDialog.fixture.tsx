import { MemoryRouter } from 'react-router';

import AboutDialog from '@/components/About/AboutDialog';

export default function AboutDialogFixture() {
  return (
    <MemoryRouter>
      <AboutDialog />
    </MemoryRouter>
  );
}
