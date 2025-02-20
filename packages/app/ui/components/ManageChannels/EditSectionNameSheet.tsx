import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { ActionSheet } from '../ActionSheet';
import { Button } from '../Button';
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
  const { control, handleSubmit } = useForm({
    defaultValues: {
      name: name ?? '',
    },
  });

  const handlePressSave = useCallback(
    async (data: { name: string }) => {
      onSave?.(data.name);
      onOpenChange(false);
    },
    [onSave, onOpenChange]
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
            }}
          />
        </ActionSheet.FormBlock>
        <ActionSheet.FormBlock>
          <Button hero onPress={handleSubmit(handlePressSave)}>
            <Button.Text>Save</Button.Text>
          </Button>
        </ActionSheet.FormBlock>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
