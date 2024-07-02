import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { View, XStack } from '../core';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import { FormInput } from './FormInput';

export function EditSectionSheet({
  onOpenChange,
  title,
  updateSection,
  deleteSection,
}: {
  onOpenChange: (open: boolean) => void;
  title: string;
  updateSection: (title: string) => void;
  deleteSection: () => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title,
    },
  });

  const handlePressSave = useCallback(
    async (data: { title: string }) => {
      updateSection(data.title);
      onOpenChange(false);
    },
    [updateSection, onOpenChange]
  );

  return (
    <ActionSheet open={true} onOpenChange={onOpenChange}>
      <ActionSheet.Header>
        <ActionSheet.Title>Edit section</ActionSheet.Title>
        <ActionSheet.Description>"{title}"</ActionSheet.Description>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingTop="$l"
          gap="$l"
          flex={1}
        >
          <View flex={1}>
            <FormInput
              control={control}
              errors={errors}
              name="title"
              label="Title"
              placeholder="Section title"
            />
          </View>
          <Button onPress={handleSubmit(handlePressSave)}>
            <Button.Text>Save</Button.Text>
          </Button>
        </XStack>
      </ActionSheet.Header>
    </ActionSheet>
  );
}
