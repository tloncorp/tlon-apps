import { useSelect } from 'react-cosmos/client';
import ShipSelector from '@/components/ShipSelector';

export default function ShipSelectorFixture() {
  const [type] = useSelect('Type', {
    options: ['default', 'combo', 'text'],
    defaultValue: 'default',
  });
  const [status] = useSelect('Status', {
    options: ['initial', 'pending', 'success', 'error'],
  });
  const statusObject = {
    initial: undefined,
    pending: { pending: true },
    success: { complete: 'yes' },
    error: { complete: 'no' },
  }[status];
  return (
    <ShipSelector ship="~fabled-faster" type={type} status={statusObject} />
  );
}
