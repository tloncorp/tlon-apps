import { UseFormReturn } from 'react-hook-form';

import { Text } from '../TextV2';

export function PhoneNumberInput({
  form,
  shouldFocus = true,
}: {
  form: UseFormReturn<{ phoneNumber: string }>;
  shouldFocus?: boolean;
}) {
  return <Text>Not Implemented</Text>;
}
