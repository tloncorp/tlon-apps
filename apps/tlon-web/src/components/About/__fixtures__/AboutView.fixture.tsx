import { MemoryRouter } from 'react-router';

import AboutView from '../AboutView';

export default function AboutViewFixture() {
  return (
    <MemoryRouter>
      <AboutView />
    </MemoryRouter>
  );
}
