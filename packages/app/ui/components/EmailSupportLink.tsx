import { TlonText } from '@tloncorp/ui';
import { ComponentProps, useCallback } from 'react';
import { Alert } from 'react-native';
import { openComposer } from 'react-native-email-link';

import { SUPPORT_EMAIL } from '../../constants';

type Props = {
  /** Leading copy; the support address is appended as the pressable part. */
  prompt?: string;
  subject: string;
  body?: string;
} & ComponentProps<typeof TlonText.Text>;

export function EmailSupportLink({
  prompt = 'Need help? Email',
  subject,
  body,
  ...textProps
}: Props) {
  const handlePress = useCallback(async () => {
    try {
      await openComposer({ to: SUPPORT_EMAIL, subject, body });
    } catch (e) {
      // The device has no mail app to hand off to. The address is already on
      // screen, so just explain why nothing opened.
      Alert.alert('No mail app found', `You can reach us at ${SUPPORT_EMAIL}.`);
    }
  }, [body, subject]);

  return (
    <TlonText.Text
      size="$label/s"
      color="$secondaryText"
      textAlign="center"
      {...textProps}
    >
      {prompt}{' '}
      <TlonText.RawText
        accessible
        accessibilityRole="link"
        accessibilityLabel={`Email ${SUPPORT_EMAIL}`}
        pressStyle={{ opacity: 0.5 }}
        textDecorationLine="underline"
        textDecorationDistance={10}
        onPress={handlePress}
      >
        {SUPPORT_EMAIL}
      </TlonText.RawText>
    </TlonText.Text>
  );
}
