import { useSelect } from 'react-cosmos/client';
import ShipConnection from '@/components/ShipConnection';

export default function ShipConnectionFixture() {
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
    <ShipConnection ship="~fabled-faster" type={type} status={statusObject} />
  );
}
