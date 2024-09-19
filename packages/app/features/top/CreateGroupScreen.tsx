import type * as db from '@tloncorp/shared/dist/db';
import { CreateGroupView } from '@tloncorp/ui';

export function CreateGroupScreen({
  goBack,
  goToChannel,
}: {
  goBack: () => void;
  goToChannel: (channel: db.Channel) => void;
}) {
  return <CreateGroupView goBack={goBack} navigateToChannel={goToChannel} />;
}
