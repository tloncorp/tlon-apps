import { Button, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { ScrollView, YStack } from 'tamagui';

import { BrowserSecureFields } from '../features/browser/BrowserSecureFields';
import type { BrowserSecureField } from '../features/browser/browserCredentialHandoff';
import { ActionSheet } from '../ui/components/ActionSheet';
import { FixtureWrapper } from './FixtureWrapper';

const fields: BrowserSecureField[] = [
  {
    id: 'email',
    label: 'Email',
    purpose: 'username',
    inputType: 'email',
    required: true,
  },
  {
    id: 'password',
    label: 'Password',
    purpose: 'current-password',
    inputType: 'password',
    required: true,
  },
  {
    id: 'otp',
    label: 'Verification code',
    purpose: 'one-time-code',
    inputType: 'numeric',
    required: true,
    exactLength: 6,
  },
];

function FieldsSheet() {
  const [open, setOpen] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const submit = () => {
    setSubmitted(true);
    setOpen(false);
  };
  return (
    <YStack padding="$xl" gap="$l">
      <Button
        label="Open secure fields"
        onPress={() => {
          setSubmitted(false);
          setOpen(true);
        }}
      />
      {submitted ? <Text>Demo submitted</Text> : null}
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        snapPointsMode="percent"
        snapPoints={[80]}
        title="Secure browser form"
      >
        <ActionSheet.SimpleHeader title="Secure browser form" />
        <ScrollView keyboardShouldPersistTaps="handled">
          <YStack padding="$xl" gap="$xl">
            <BrowserSecureFields
              fields={fields}
              formId="demo"
              values={values}
              disabled={false}
              showSections={false}
              onChange={(id, value) =>
                setValues((old) => ({ ...old, [id]: value }))
              }
              onSubmit={submit}
            />
            <Button label="Submit demo" onPress={submit} />
            <Button
              label="Clear fields"
              preset="minimal"
              onPress={() => setValues({})}
            />
          </YStack>
        </ScrollView>
      </ActionSheet>
    </YStack>
  );
}

export default function BrowserSecureFieldsFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <FieldsSheet />
    </FixtureWrapper>
  );
}
