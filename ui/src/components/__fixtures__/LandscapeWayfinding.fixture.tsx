import { MemoryRouter } from 'react-router';
import LandscapeWayfinding from '@/components/LandscapeWayfinding';

export default function LandscapeWayfindingFixture() {
  return (
    <MemoryRouter>
      <LandscapeWayfinding />
    </MemoryRouter>
  );
}
