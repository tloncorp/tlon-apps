import { CalmProvider, ContactList, ContactsProvider } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { initialContacts } from './fakeData';

const ContactListFixture = ({
  matchText,
  showAlias,
  showBoth,
}: {
  matchText?: string;
  showBoth?: boolean;
  showAlias?: boolean;
}) => {
  return (
    <FixtureWrapper>
      <ContactsProvider contacts={initialContacts}>
        <CalmProvider
          calmSettings={{
            disableNicknames: false,
            disableAvatars: false,
            disableRemoteContent: false,
          }}
        >
          <ContactList>
            {initialContacts.map((contact) => (
              <ContactList.Item
                alignItems="center"
                showNickname={showAlias}
                showUserId={showBoth}
                justifyContent="flex-start"
                padding="$s"
                key={contact.id}
                contact={contact}
                matchText={matchText}
              />
            ))}
          </ContactList>
        </CalmProvider>
      </ContactsProvider>
    </FixtureWrapper>
  );
};

export default {
  default: ContactListFixture,
  showBoth: () => <ContactListFixture showBoth />,
  showAlias: () => <ContactListFixture showAlias />,
  withMatchText: () => <ContactListFixture showBoth matchText="len" />,
};
