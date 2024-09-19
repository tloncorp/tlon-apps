import { FindGroupsView } from '@tloncorp/ui';

import { useGroupActions } from '../../hooks/useGroupActions';

export function FindGroupsScreen({ onCancel }: { onCancel: () => void }) {
  const { performGroupAction } = useGroupActions();

  return (
    <FindGroupsView onCancel={onCancel} onGroupAction={performGroupAction} />
  );
}
