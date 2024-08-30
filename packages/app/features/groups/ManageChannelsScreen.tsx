import { ManageChannelsScreenView } from '@tloncorp/ui';

import { useGroupContext } from '../../hooks/useGroupContext';

export function ManageChannelsScreen({
  groupId,
  onGoBack,
  onGoToEditChannel,
}: {
  groupId: string;
  onGoBack: () => void;
  onGoToEditChannel: (channelId: string) => void;
}) {
  const {
    groupNavSectionsWithChannels,
    moveNavSection,
    moveChannel,
    moveChannelToNavSection,
    createChannel,
    createNavSection,
    deleteNavSection,
    updateNavSection,
  } = useGroupContext({ groupId });

  return (
    <ManageChannelsScreenView
      goBack={onGoBack}
      goToEditChannel={onGoToEditChannel}
      groupNavSectionsWithChannels={groupNavSectionsWithChannels}
      moveNavSection={moveNavSection}
      moveChannelWithinNavSection={moveChannel}
      moveChannelToNavSection={moveChannelToNavSection}
      createChannel={createChannel}
      createNavSection={createNavSection}
      deleteNavSection={deleteNavSection}
      updateNavSection={updateNavSection}
    />
  );
}
