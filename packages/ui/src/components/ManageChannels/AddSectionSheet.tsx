import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { YStack } from '../../core';
import { ActionSheet } from '../ActionSheet';
import { Button } from '../Button';
import { FormInput } from '../FormInput';

export function AddSectionSheet({
  onOpenChange,
  createSection,
}: {
  onOpenChange: (open: boolean) => void;
  createSection: (title: string) => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: '',
    },
  });

  const handlePressSave = useCallback(
    async (data: { title: string }) => {
      createSection(data.title);
      onOpenChange(false);
    },
    [createSection, onOpenChange]
  );

  return (
    <ActionSheet moveOnKeyboardChange open={true} onOpenChange={onOpenChange}>
      <ActionSheet.Header>
        <ActionSheet.Title>Create section</ActionSheet.Title>
        <YStack
          alignItems="center"
          justifyContent="space-between"
          paddingTop="$l"
          gap="$l"
          flex={1}
        >
          <FormInput
            control={control}
            errors={errors}
            name="title"
            label="Title"
            placeholder="Section title"
            rules={{ required: 'Section title is required' }}
          />
          <Button hero onPress={handleSubmit(handlePressSave)}>
            <Button.Text>Save</Button.Text>
          </Button>
        </YStack>
      </ActionSheet.Header>
    </ActionSheet>
  );
}
