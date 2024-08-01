import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ErrorReporter } from '@tloncorp/shared/dist';
import {
  Button,
  Circle,
  FormTextInput,
  GenericHeader,
  Icon,
  SizableText,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'WompWomp'>;

export function UserBugReportScreen(props: Props) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'initial' | 'sent'>('initial');

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardDidShowListener = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  const onGoBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const { control, handleSubmit, formState } = useForm({
    defaultValues: {
      additionalNotes: '',
    },
  });

  const sendBugReport = useCallback(
    (submission: { additionalNotes: string }) => {
      console.log(`got additional notes`, submission.additionalNotes);
      const reporter = new ErrorReporter(
        'User manually submitted a bug report'
      );
      if (submission.additionalNotes) {
        reporter.log(`User attached notes:`);
        reporter.log(submission.additionalNotes);
      }
      reporter.report(null);
      setState('sent');
      setTimeout(() => {
        if (isFocusedRef.current) {
          onGoBack();
        }
      }, 3000);
    },
    [onGoBack]
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}>
      <GenericHeader goBack={state === 'initial' ? onGoBack : undefined} />
      <YStack
        marginTop="$m"
        flex={1}
        marginHorizontal="$2xl"
        justifyContent={keyboardVisible ? 'unset' : 'space-between'}
        onPress={() => Keyboard.dismiss()}
      >
        <YStack>
          {!keyboardVisible && (
            <YStack
              backgroundColor="$secondaryBackground"
              padding="$l"
              alignItems="center"
              borderRadius="$l"
            >
              <Circle marginBottom="$s">
                <Icon type="Send" />
              </Circle>
              <SizableText fontSize="$xl">Send a bug report</SizableText>
              <SizableText
                marginHorizontal="$2xl"
                marginTop="$l"
                size="$s"
                color="$secondaryText"
                textAlign="center"
              >
                If you experienced an issue, let us know! Sending reports helps
                us improve the app for everyone.
              </SizableText>
            </YStack>
          )}
          <View paddingTop="$2xl">
            {state === 'initial' ? (
              <>
                <SizableText
                  marginHorizontal="$m"
                  marginBottom="$l"
                  size="$s"
                  color="$tertiaryText"
                >
                  Information to help us diagnose the issue will be
                  automatically attached.
                </SizableText>
                <FormTextInput>
                  <FormTextInput.Label marginLeft="$xs">
                    Additional Notes
                  </FormTextInput.Label>
                  <FormTextInput.Input
                    control={control}
                    errors={formState.errors}
                    rules={{
                      maxLength: {
                        value: 300,
                        message:
                          'Bug report notes are limited to 300 characters.',
                      },
                    }}
                    name="additionalNotes"
                    label="Additional Notes"
                    placeholder="What went wrong?"
                    frameProps={{
                      height: 150,
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      overflow: 'scroll',
                    }}
                    areaProps={{
                      multiline: true,
                      fontSize: '$s',
                      lineHeight: '$xs',
                      textAlignVertical: 'top',
                    }}
                  />
                </FormTextInput>
              </>
            ) : (
              <YStack paddingTop="$2xl" alignItems="center">
                <XStack alignItems="center">
                  <Icon type="Checkmark" />

                  <SizableText fontSize="$l">Report sent</SizableText>
                </XStack>
                <SizableText
                  marginHorizontal="$2xl"
                  marginTop="$l"
                  fontSize="$s"
                  color="$secondaryText"
                  textAlign="center"
                >
                  Our team will investigate. Thank you for your feedback!
                </SizableText>
              </YStack>
            )}
          </View>
        </YStack>
        <Button
          hero
          onPress={handleSubmit(sendBugReport)}
          disabled={state === 'sent'}
          marginBottom={insets.bottom + 40}
          marginTop={keyboardVisible ? '$l' : 'unset'}
        >
          <Button.Text>Send Report</Button.Text>
        </Button>
      </YStack>
    </KeyboardAvoidingView>
  );
}
