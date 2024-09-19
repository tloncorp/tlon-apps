import { CreateGroupView } from '@tloncorp/ui';
import { useGroupNavigation } from '../../hooks/useGroupNavigation';

export function CreateGroupScreen({ goBack }: { goBack: () => void }) {
  const { goToChannel } = useGroupNavigation();

  return <CreateGroupView goBack={goBack} navigateToChannel={goToChannel} />;
}
