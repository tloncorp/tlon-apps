import { useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { useContact, useCurrentUserId } from '../contexts';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import { ControlledTextField } from './Form';
import { Icon } from './Icon';

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
        <YStack flex={1} marginHorizontal="$2xl" gap="$l">
          <XStack gap="$m" alignItems="flex-end" width="100%">
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
                multiline: false,
                maxLength: 50,
              }}
              flex={1}
              rules={{
                maxLength: {
                  value: 50,
                  message: 'Your status is limited to 50 characters',
                },
              }}
            />
            <Button
              hero
              onPress={handleSave}
              disabled={!isValid}
              paddingHorizontal="$l"
            >
              <Icon type="Send" color="$background" />
            </Button>
          </XStack>
        </YStack>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
