import { useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { YStack } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts';
import { ActionSheet } from './ActionSheet';
import { ControlledTextField } from './Form';

export default function ProfileStatusSheet({
  open,
  onOpenChange,
  onUpdateStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (status: string) => void;
}) {
  const currentUserId = useCurrentUserId();
  const userContact = useContact(currentUserId);
  const {
    control,
    handleSubmit,
    formState: { isDirty, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      status: userContact?.status ?? '',
    },
  });

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        Keyboard.dismiss();
        onOpenChange(false);
      }
    },
    [onOpenChange]
  );

  const handleSave = useCallback(() => {
    if (isDirty) {
      handleSubmit((formData) => {
        onUpdateStatus(formData.status);
      })();
    }
    handleClose(false);
  }, [handleClose, handleSubmit, isDirty, onUpdateStatus]);

  return (
    <ActionSheet
      open={open}
      onOpenChange={handleClose}
      // TODO: manually calculate keyboard + input height?
      snapPointsMode="percent"
      snapPoints={[60]}
    >
      <ActionSheet.Content flex={1} paddingBottom={0}>
        <YStack flex={1} marginHorizontal="$2xl">
          <ControlledTextField
            name="status"
            label="Update your status"
            control={control}
            inputProps={{
              placeholder: 'Hanging out...',
              autoFocus: true,
              returnKeyType: isValid ? 'send' : 'done',
              onSubmitEditing: handleSave,
              blurOnSubmit: true,
              multiline: true,
              maxLength: 50,
            }}
            rules={{
              maxLength: {
                value: 50,
                message: 'Your status is limited to 50 characters',
              },
            }}
          />
        </YStack>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
