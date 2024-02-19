import { MemoryRouter } from 'react-router';

import ActivityModal from '@/components/ActivityModal';

export default function ActivityModalFixture() {
  return (
    <MemoryRouter>
      <ActivityModal />
    </MemoryRouter>
  );
}
