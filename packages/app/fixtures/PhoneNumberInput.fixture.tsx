import { Text } from '@tloncorp/ui';
import { useForm, useWatch } from 'react-hook-form';
import { YStack } from 'tamagui';

import { PhoneNumberInput } from '../ui/components/Form/PhoneNumberInput';
import { FixtureWrapper } from './FixtureWrapper';

function PhoneNumberInputFixture() {
  const form = useForm<{ phoneNumber: string }>({
    mode: 'onChange',
    defaultValues: { phoneNumber: '' },
  });
  const value = useWatch({ control: form.control, name: 'phoneNumber' });

  return (
    <FixtureWrapper fillWidth safeArea>
      <YStack padding="$2xl" gap="$2xl">
        <Text size="$title/l">Phone Number Input</Text>
        <PhoneNumberInput form={form} shouldFocus={false} />
        <Text size="$label/m" color="$secondaryText">
          {`Stored E.164: ${value || '(empty)'}`}
        </Text>
      </YStack>
    </FixtureWrapper>
  );
}

export default {
  'Phone Number Input': <PhoneNumberInputFixture />,
};
