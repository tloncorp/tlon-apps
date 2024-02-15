import { useValue } from 'react-cosmos/client';

import IconButton from '../IconButton';
import TlonIcon from '../icons/TlonIcon';

export default function IconButtonFixture() {
  const [{ showTooltip, tooltipText }] = useValue('Tooltip', {
    defaultValue: { showTooltip: true, tooltipText: 'Tooltip' },
  });
  const [isSmall] = useValue('Small', { defaultValue: false });

  return (
    <IconButton
      small={isSmall}
      showTooltip={showTooltip}
      label={tooltipText}
      className="rounded border border-gray-100 bg-white"
      icon={<TlonIcon className="h-6 w-6 text-gray-400" />}
    />
  );
}
