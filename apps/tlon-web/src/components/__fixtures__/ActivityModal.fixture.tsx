import ActivityModal from '@/components/ActivityModal';
import { MemoryRouter } from 'react-router';

export default function ActivityModalFixture() {
  return (
    <MemoryRouter>
      <ActivityModal />
    </MemoryRouter>
  );
}
