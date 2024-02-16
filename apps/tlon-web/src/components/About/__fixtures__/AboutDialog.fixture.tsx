import AboutDialog from '@/components/About/AboutDialog';
import { MemoryRouter } from 'react-router';

export default function AboutDialogFixture() {
  return (
    <MemoryRouter>
      <AboutDialog />
    </MemoryRouter>
  );
}
