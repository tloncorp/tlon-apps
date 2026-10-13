import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared';
import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { RootStackParamList } from '../../navigation/types';
import { SettingsListScreenView } from '../../ui/components/SettingsList';

type Props = NativeStackScreenProps<RootStackParamList, 'WompWomp'>;

const logger = createDevLogger('bug-report', false);

const maxNotesLength = 300;
/** The footer starts counting down once this few characters remain. */
const remainingNoticeAt = 50;

const showAlert = () => {
  if (Platform.OS === 'web') {
    window.alert(
      'Bug report sent. Our team will investigate. Thank you for your feedback!'
    );
    return;
  }
  Alert.alert(
    'Bug report sent',
    'Our team will investigate. Thank you for your feedback!',
    [{ text: 'OK' }]
  );
};

/** Composed like a message, with Send in the navigation bar. */
export function UserBugReportScreen({ navigation }: Props) {
  const [notes, setNotes] = useState('');

  const sendBugReport = useCallback(() => {
    if (notes) {
      logger.crumb(`User attached notes:`);
      logger.sensitiveCrumb(notes);
    }
    logger.trackError('User manually submitted a bug report');
    showAlert();
  }, [notes]);

  const remaining = maxNotesLength - notes.length;

  return (
    <SettingsListScreenView
      title="Report a bug"
      sections={[
        {
          key: 'notes',
          footer: [
            'If you experienced an issue, let us know! Sending reports helps us improve the app for everyone.',
            'Information to help us diagnose the issue will be automatically attached.',
            remaining <= remainingNoticeAt
              ? `${remaining} ${remaining === 1 ? 'character' : 'characters'} left.`
              : null,
          ]
            .filter(Boolean)
            .join(' '),
          rows: [
            {
              key: 'notes',
              title: 'Additional notes',
              textField: {
                value: notes,
                onChangeText: setNotes,
                placeholder: 'What went wrong?',
                lines: 6,
                maxLength: maxNotesLength,
                capitalization: 'sentences',
              },
            },
          ],
        },
      ]}
      onBackPressed={() => navigation.goBack()}
      rightActions={[
        { id: 'send-report', text: 'Send', onPress: sendBugReport },
      ]}
    />
  );
}
