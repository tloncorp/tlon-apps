import { MemoryRouter } from 'react-router';

import Leap from '../Leap';

export default function LeapFixture() {
  return (
    <MemoryRouter>
      <Leap openDefault={true} />
    </MemoryRouter>
  );
}
