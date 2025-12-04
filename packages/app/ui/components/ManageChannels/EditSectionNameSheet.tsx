import { Button } from '@tloncorp/ui';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { ActionSheet } from '../ActionSheet';
import * as Form from '../Form';

export function EditSectionNameSheet({
  name,
  mode,
  open,
  onOpenChange,
  onSave,
}: {
  name?: string;
  mode: 'edit' | 'add';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (name: string) => void;
}) {
  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      name: name ?? '',
    },
  });

  useEffect(() => {
    reset({ name: name ?? '' });
  }, [name, reset]);

  const handlePressSave = useCallback(
    async (data: { name: string }) => {
      await onSave?.(data.name);
      reset();
      onOpenChange(false);
    },
    [onSave, onOpenChange, reset]
  );

  return (
    <ActionSheet moveOnKeyboardChange open={open} onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader
        title={mode === 'add' ? 'Add section' : 'Change section name'}
      />
      <ActionSheet.Content>
        <ActionSheet.FormBlock>
          <Form.ControlledTextField
            control={control}
            name="name"
            label="Title"
            rules={{ required: 'Section name is required' }}
            inputProps={{
              placeholder: 'e.g. Important channels',
              testID: 'SectionNameInput',
            }}
          />
        </ActionSheet.FormBlock>
        <ActionSheet.FormBlock>
          <Button fill="solid" type="primary" onPress={handleSubmit(handlePressSave)} label="Save" centered />
        </ActionSheet.FormBlock>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
