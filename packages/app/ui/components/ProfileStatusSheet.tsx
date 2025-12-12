import { Button } from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import { useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Keyboard } from 'react-native';
import { XStack, YStack } from 'tamagui';

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
    <ActionSheet open={open} onOpenChange={handleClose} modal>
      <ActionSheet.Content paddingBottom="$xl">
        <YStack marginHorizontal="$2xl" gap="$l">
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
              onPress={handleSave}
              disabled={!isValid}
              paddingVertical="$l"
              borderColor="transparent"
            >
              <Icon type="ArrowUp" />
            </Button>
          </XStack>
        </YStack>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
