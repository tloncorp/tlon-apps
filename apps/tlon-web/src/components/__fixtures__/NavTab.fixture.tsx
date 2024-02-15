import NavTab from '@/components/NavTab';
import AppGroupsIcon from '@/components/icons/AppGroupsIcon';
import { MemoryRouter } from 'react-router';

export default function NavTabFixture() {
  return (
    <MemoryRouter>
      <NavTab to="/" linkClass="basis-1/5">
        <AppGroupsIcon className="mb-0.5 h-6 w-6" />
        Groups
      </NavTab>
    </MemoryRouter>
  );
}
