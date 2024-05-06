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
          initialCalm={{
            disableNicknames: false,
            disableAppTileUnreads: false,
            disableAvatars: false,
            disableRemoteContent: false,
            disableSpellcheck: false,
          }}
        >
          <ContactList>
            {initialContacts.map((contact) => (
              <ContactList.Item
                alignItems="center"
                showBoth={showBoth}
                showAlias={showAlias}
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
