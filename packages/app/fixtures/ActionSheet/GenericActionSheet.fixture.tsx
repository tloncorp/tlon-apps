import { useState } from 'react';
import { Button, ListItem, Text } from '../../ui';
import { ActionGroup, ActionSheet } from '../../ui/components/ActionSheet';
import { NotesActionMenu } from '../../ui/components/NotesChannel/NotesActions';
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
        snapPointsMode="percent"
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

const CompactActionMenuFixture = ({
  compact = true,
}: {
  compact?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('No action selected');
  const actions = [
    {
      title: 'Open in browser',
      startIcon: 'ExternalLink' as const,
      action: () => setSelected('Open selected'),
    },
    {
      title: 'Delete file',
      startIcon: 'Trash' as const,
      accent: 'negative' as const,
      action: () => setSelected('Delete selected'),
    },
  ];
  return (
    <FixtureWrapper fillWidth>
      <Text>{selected}</Text>
      <NotesActionMenu
        groups={[{ accent: 'neutral', actions }]}
        open={open}
        onOpenChange={setOpen}
        header={
          compact ? undefined : { title: 'File actions', icon: 'Attachment' }
        }
        onAction={(action) => {
          setOpen(false);
          action?.();
        }}
        trigger={<Button onPress={() => setOpen(true)} label="Show actions" />}
      />
    </FixtureWrapper>
  );
};

export default {
  default: <ActionSheetFixture />,
  'Compact actions': <CompactActionMenuFixture />,
  'Actions with header': <CompactActionMenuFixture compact={false} />,
};
