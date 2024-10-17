import { ListItem } from '@tloncorp/ui';
import {
  ActionGroup,
  ActionSheet,
} from '@tloncorp/ui/src/components/ActionSheet';

import { FixtureWrapper } from '../FixtureWrapper';

const ActionSheetFixture = () => {
  const actionGroups: ActionGroup[] = [
    {
      accent: 'positive',
      actions: [
        {
          title: 'Invite people',
          description: 'Share a link to join this group',
          action: () => console.log('Action 1'),
        },
      ],
    },
    {
      accent: 'neutral',
      actions: [
        {
          title: 'Group settings',
          description: 'Configure group details and privacy',
          action: () => console.log('Action 1'),
        },
      ],
    },
    {
      accent: 'neutral',
      actions: [
        {
          title: 'Pin',
          description: 'Pin this group to the top of your groups list',
        },
        {
          title: 'Copy group link',
          description: 'Copy an in-urbit link to this group',
        },
        { title: 'Group members', description: 'View all members and roles' },
        {
          title: 'All channels',
          description:
            'View all channels and sections you have visibility towards',
        },
        {
          title: 'Group notification settings',
          description: 'Configure notifications for this group',
        },
      ],
    },
    {
      accent: 'negative',
      actions: [
        {
          title: 'Leave group',
          description: undefined,
        },
      ],
    },
  ] as const;

  return (
    <FixtureWrapper fillWidth>
      <ActionSheet
        snapPointsMode="mixed"
        snapPoints={['90%']}
        open={true}
        onOpenChange={(open: boolean) => console.log('Open Change', open)}
      >
        <ActionSheet.Header>
          <ListItem.MainContent>
            <ListItem.Title>Action Sheet Title</ListItem.Title>
            <ListItem.Subtitle>Action sheet description</ListItem.Subtitle>
          </ListItem.MainContent>
        </ActionSheet.Header>
        <ActionSheet.ScrollableContent>
          {actionGroups.map((group, index) => (
            <ActionSheet.ActionGroup key={index} accent={group.accent}>
              {group.actions.map((action, index) => (
                <ActionSheet.Action key={index} action={action} />
              ))}
            </ActionSheet.ActionGroup>
          ))}
        </ActionSheet.ScrollableContent>
      </ActionSheet>
    </FixtureWrapper>
  );
};

export default {
  default: <ActionSheetFixture />,
};
