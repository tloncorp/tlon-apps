import * as SMS from 'expo-sms';
import Share from 'react-native-share';

export async function shareSms(numbers: string[]) {
  const snedResult = await SMS.sendSMSAsync(
    numbers,
    'Invite to Tlon Messenger!'
  );
  console.log(`bl: send result`, snedResult);
}
