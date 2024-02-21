import { MemoryRouter } from 'react-router';

import LoadingSpinner from '../LoadingSpinner';

export default function LoadingSpinnerFixture() {
  return (
    <MemoryRouter>
      <LoadingSpinner />
    </MemoryRouter>
  );
}
