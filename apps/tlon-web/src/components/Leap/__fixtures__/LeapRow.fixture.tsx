import { useValue } from 'react-cosmos/client';
import { MemoryRouter } from 'react-router';

import GlobeIcon from '@/components/icons/GlobeIcon';

import LeapRow from '../LeapRow';

export default function LeapRowFixture() {
  const [isSelected] = useValue('isSelected', { defaultValue: false });

  const rowOptions = {
    icon: GlobeIcon,
    title: 'Title',
    subtitle: 'Subtitle',
    to: '',
    onSelect: () => null,
    resultIndex: 0,
  };
  return (
    <MemoryRouter>
      <LeapRow selected={isSelected} option={rowOptions} />
    </MemoryRouter>
  );
}
