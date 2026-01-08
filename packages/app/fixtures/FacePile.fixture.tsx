import { FacePile, SizableText, View, YStack } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import {
  brianContact,
  danContact,
  edContact,
  galenContact,
  hunterContact,
  initialContacts,
  jamesContact,
  markContact,
} from './fakeData';

export default (
  <FixtureWrapper fillWidth>
    <YStack gap="$l" padding="$l">
      <View>
        <SizableText size="$s" color="$secondaryText">
          Single Contact
        </SizableText>
        <FacePile contactIds={[brianContact.id]} />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Two Contacts
        </SizableText>
        <FacePile contactIds={[brianContact.id, galenContact.id]} />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Three Contacts
        </SizableText>
        <FacePile
          contactIds={[brianContact.id, galenContact.id, jamesContact.id]}
        />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Four Contacts (Max Visible)
        </SizableText>
        <FacePile
          contactIds={[
            brianContact.id,
            galenContact.id,
            jamesContact.id,
            danContact.id,
          ]}
        />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Five Contacts (Shows +1)
        </SizableText>
        <FacePile
          contactIds={[
            brianContact.id,
            galenContact.id,
            jamesContact.id,
            danContact.id,
            hunterContact.id,
          ]}
        />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Seven Contacts (Shows +3)
        </SizableText>
        <FacePile
          contactIds={[
            brianContact.id,
            galenContact.id,
            jamesContact.id,
            danContact.id,
            hunterContact.id,
            markContact.id,
            edContact.id,
          ]}
        />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          All Initial Contacts (Shows +3)
        </SizableText>
        <FacePile contactIds={initialContacts.map((c) => c.id)} />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Custom Max Visible (2)
        </SizableText>
        <FacePile
          contactIds={[
            brianContact.id,
            galenContact.id,
            jamesContact.id,
            danContact.id,
            hunterContact.id,
          ]}
          maxVisible={2}
        />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Empty Contacts
        </SizableText>
        <FacePile contactIds={[]} />
      </View>
    </YStack>
  </FixtureWrapper>
);