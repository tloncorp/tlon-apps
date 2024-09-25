import { FindGroupsView } from '@tloncorp/ui';

export function FindGroupsScreen({
  goBack,
  goToUserGroups,
}: {
  goBack: () => void;
  goToUserGroups: (params: { contactId: string }) => void;
}) {
  return <FindGroupsView goBack={goBack} goToUserGroups={goToUserGroups} />;
}
