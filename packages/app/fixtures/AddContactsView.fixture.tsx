import { AddContactsView } from '../ui/components/AddContactsView';
import { FixtureWrapper } from './FixtureWrapper';

function AddContactsViewFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <AddContactsView
        goBack={() => console.log('Go back')}
        addContacts={(ids) => console.log('Add contacts:', ids)}
      />
    </FixtureWrapper>
  );
}

export default {
  'Add Contacts View': <AddContactsViewFixture />,
};
