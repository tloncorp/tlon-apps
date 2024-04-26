import { ActionSheet } from '@tloncorp/ui/src/components/ActionSheet';

import { FixtureWrapper } from './FixtureWrapper';

const ActionSheetFixture = () => {
  const actions = [
    {
      title: 'Action 1',
      action: () => console.log('Action 1'),
      description: 'Action 1 Description',
    },
    {
      title: 'Action 2',
      action: () => console.log('Action 2'),
      description: 'Action 2 Description',
      variant: 'success',
    },
    {
      title: 'Action 3',
      action: () => console.log('Action 3'),
      description: 'Action 3 Description',
      variant: 'destructive',
    },
    {
      title: 'Action 4',
      action: () => console.log('Action 4'),
      description: 'Action 4 Description',
      variant: 'primary',
    },
  ];

  return (
    <FixtureWrapper fillWidth>
      <ActionSheet
        open={true}
        onOpenChange={(open: boolean) => console.log('Open Change', open)}
      >
        <ActionSheet.Header>
          <ActionSheet.Title>Action Sheet Title</ActionSheet.Title>
          <ActionSheet.Description>
            Action Sheet Description
          </ActionSheet.Description>
        </ActionSheet.Header>
        {actions.map((action, index) => (
          <ActionSheet.Action
            key={index}
            success={action.variant === 'success'}
            destructive={action.variant === 'destructive'}
            primary={action.variant === 'primary'}
            action={action.action}
          >
            <ActionSheet.ActionTitle>{action.title}</ActionSheet.ActionTitle>
            {action.description && (
              <ActionSheet.ActionDescription>
                {action.description}
              </ActionSheet.ActionDescription>
            )}
          </ActionSheet.Action>
        ))}
      </ActionSheet>
    </FixtureWrapper>
  );
};

export default {
  default: <ActionSheetFixture />,
};
