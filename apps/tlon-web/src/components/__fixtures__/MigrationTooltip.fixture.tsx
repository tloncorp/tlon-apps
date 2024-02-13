import MigrationTooltip from '@/components/MigrationTooltip';
import { useSelect } from 'react-cosmos/client';

export default function MigrationTooltipFixture() {
  const [side] = useSelect('Side', {
    defaultValue: 'bottom',
    options: ['top', 'left', 'bottom', 'right'],
  });

  const [kind] = useSelect('Kind', {
    options: ['group', 'channel'],
  });

  return (
    <MigrationTooltip side={side} kind={kind} ship={window.ship}>
      <div className="rounded-xl bg-white p-4">Click to display tooltip</div>
    </MigrationTooltip>
  );
}
