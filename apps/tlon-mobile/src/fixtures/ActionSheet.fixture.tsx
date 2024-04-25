import ActionSheet from '@tloncorp/ui/src/components/ActionSheet';

import { FixtureWrapper } from './FixtureWrapper';

const ActionSheetFixture = () => {
  return (
    <FixtureWrapper fillWidth>
      <ActionSheet
        sheetTitle="Action Sheet Title"
        sheetDescription="Action Sheet Description"
        open={true}
        onOpenChange={(open) => console.log('Open Change', open)}
        actions={[
          {
            title: 'Action 1',
            action: () => console.log('Action 1'),
            description: 'Action 1 Description',
          },
          {
            title: 'Action 2',
            action: () => console.log('Action 2'),
            description: 'Action 2 Description',
            backgroundColor: '$greenSoft',
            titleColor: '$green',
            borderColor: '$green',
          },
          {
            title: 'Action 3',
            action: () => console.log('Action 3'),
            description: 'Action 3 Description',
            backgroundColor: '$redSoft',
            titleColor: '$red',
            borderColor: '$red',
          },
        ]}
      />
    </FixtureWrapper>
  );
};

export default {
  default: <ActionSheetFixture />,
};
