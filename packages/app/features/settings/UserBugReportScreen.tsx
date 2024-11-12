import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared';
import {
  Button,
  ControlledTextareaField,
  FormFrame,
  FormText,
  ScreenHeader,
  ScrollView,
  YStack,
} from '@tloncorp/ui';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView } from 'react-native';

import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'WompWomp'>;

const logger = createDevLogger('bug-report', false);

export function UserBugReportScreen({ navigation }: Props) {
  const { control, handleSubmit } = useForm({
    defaultValues: {
      additionalNotes: '',
    },
  });

  const sendBugReport = useCallback(
    (submission: { additionalNotes: string }) => {
      if (submission.additionalNotes) {
        logger.crumb(`User attached notes:`);
        logger.crumb(submission.additionalNotes);
      }
      logger.trackError('User manually submitted a bug report');
      Alert.alert(
        'Bug report sent',
        'Our team will investigate. Thank you for your feedback!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    },
    [navigation]
  );

  return (
    <>
      <ScreenHeader
        title="Report a bug"
        backAction={() => navigation.goBack()}
      />
      <KeyboardAvoidingView style={{ flex: 1 }}>
        <ScrollView flex={1} keyboardDismissMode="on-drag">
          <FormFrame>
            <FormText>
              If you experienced an issue, let us know! Sending reports helps us
              improve the app for everyone.
            </FormText>
            <ControlledTextareaField
              name="additionalNotes"
              label="Additional notes"
              control={control}
              inputProps={{
                placeholder: 'What went wrong?',
                numberOfLines: 5,
                multiline: true,
              }}
              rules={{
                maxLength: {
                  value: 300,
                  message: 'Bug report notes are limited to 300 characters',
                },
              }}
            />
            <FormText size="$label/m" color="$tertiaryText">
              Information to help us diagnose the issue will be automatically
              attached.
            </FormText>
            <Button hero onPress={handleSubmit(sendBugReport)}>
              <Button.Text>Send Report</Button.Text>
            </Button>
          </FormFrame>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
