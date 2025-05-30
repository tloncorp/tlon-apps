import { MetaEditorScreenView } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { group } from './fakeData';

const GroupMetaScreenFixture = () => {
  return (
    <FixtureWrapper>
      <MetaEditorScreenView
        title="Edit group meta"
        onSubmit={() => {}}
        chat={group}
        goBack={() => console.log('goBack')}
        currentUserId="~mister-dister"
      />
    </FixtureWrapper>
  );
};

export default GroupMetaScreenFixture;
