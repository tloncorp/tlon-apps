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
        <FacePile contacts={[brianContact]} />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Two Contacts
        </SizableText>
        <FacePile contacts={[brianContact, galenContact]} />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Three Contacts
        </SizableText>
        <FacePile contacts={[brianContact, galenContact, jamesContact]} />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Four Contacts (Max Visible)
        </SizableText>
        <FacePile
          contacts={[brianContact, galenContact, jamesContact, danContact]}
        />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Five Contacts (Shows +1)
        </SizableText>
        <FacePile
          contacts={[
            brianContact,
            galenContact,
            jamesContact,
            danContact,
            hunterContact,
          ]}
        />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Seven Contacts (Shows +3)
        </SizableText>
        <FacePile
          contacts={[
            brianContact,
            galenContact,
            jamesContact,
            danContact,
            hunterContact,
            markContact,
            edContact,
          ]}
        />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          All Initial Contacts (Shows +3)
        </SizableText>
        <FacePile contacts={initialContacts} />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Custom Max Visible (2)
        </SizableText>
        <FacePile
          contacts={[
            brianContact,
            galenContact,
            jamesContact,
            danContact,
            hunterContact,
          ]}
          maxVisible={2}
        />
      </View>

      <View>
        <SizableText size="$s" color="$secondaryText">
          Empty Contacts
        </SizableText>
        <FacePile contacts={[]} />
      </View>
    </YStack>
  </FixtureWrapper>
);