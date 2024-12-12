import * as api from '@tloncorp/shared/api';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import { PhoneNumberInput } from './Form/PhoneNumberInput';
import { Text } from './TextV2';

export function VerifyPhoneNumberSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  type PhoneFormData = {
    phoneNumber: string;
  };

  const phoneForm = useForm<PhoneFormData>({
    defaultValues: {
      phoneNumber: '',
    },
  });

  //
  const handleSubmitPhoneNumber = useCallback(() => {
    api.initiatePhoneVerify('+12623881275');
  }, []);

  return (
    <ActionSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      snapPointsMode="percent"
      snapPoints={[80]}
    >
      <ActionSheet.SimpleHeader title="Verify Phone Number" />
      <ActionSheet.ContentBlock>
        <ActionSheet.Content>
          <ActionSheet.ContentBlock paddingTop={0}>
            <Text color="$secondaryText">
              Verifying your phone number lets anyone who has you in their phone
              book look you up on the network. Your phone number will not be
              publically visible.
            </Text>
          </ActionSheet.ContentBlock>
          <ActionSheet.ContentBlock gap="$xl">
            <PhoneNumberInput form={phoneForm} />
            <Button hero onPress={handleSubmitPhoneNumber}>
              <Button.Text>Send verification code</Button.Text>
            </Button>
          </ActionSheet.ContentBlock>
        </ActionSheet.Content>
      </ActionSheet.ContentBlock>
    </ActionSheet>
  );
}
