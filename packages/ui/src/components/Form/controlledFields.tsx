import React, { ComponentProps, useCallback } from 'react';
import {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
  UseControllerReturn,
  useController,
} from 'react-hook-form';

import { Field } from './Form';
import {
  ListItemInput,
  ListItemInputOption,
  RadioInput,
  RadioInputOption,
  TextInput,
} from './inputs';

type ControlledFieldProps<
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
> = {
  name: TName;
  control: Control<TFieldValues>;
  label?: string;
  rules?: RegisterOptions<TFieldValues, TName>;
  renderInput: (
    controller: UseControllerReturn<TFieldValues, TName>
  ) => React.ReactElement;
};

export const ControlledField = <
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
>({
  name,
  label,
  control,
  rules,
  renderInput,
}: ControlledFieldProps<TFieldValues, TName>) => {
  const controller = useController({
    name,
    control,
    rules,
  });
  return (
    <Field
      required={!!rules?.required}
      label={label}
      error={controller.fieldState?.error?.message}
    >
      {renderInput(controller)}
    </Field>
  );
};

export const ControlledTextField = <
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
>(
  props: { inputProps?: ComponentProps<typeof TextInput> } & Omit<
    ControlledFieldProps<TFieldValues, TName>,
    'renderInput'
  >
) => {
  const renderInput = useCallback(
    ({
      field: { onChange, ...field },
    }: UseControllerReturn<TFieldValues, TName>) => {
      return (
        <TextInput {...field} onChangeText={onChange} {...props.inputProps} />
      );
    },
    [props.inputProps]
  );
  return <ControlledField {...props} renderInput={renderInput} />;
};

export const ControlledRadioField = <
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
>({
  options,
  ...props
}: { options: RadioInputOption<TFieldValues[TName]>[] } & Omit<
  ControlledFieldProps<TFieldValues, TName>,
  'renderInput'
>) => {
  const renderInput = useCallback(
    ({
      field: { ref: _ref, ...field },
    }: UseControllerReturn<TFieldValues, TName>) => {
      return <RadioInput options={options} {...field} />;
    },
    [options]
  );
  return <ControlledField {...props} renderInput={renderInput} />;
};

export const ControlledListItemField = <
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
>({
  options,
  ...props
}: { options: ListItemInputOption<TFieldValues[TName]>[] } & Omit<
  ControlledFieldProps<TFieldValues, TName>,
  'renderInput'
>) => {
  const renderInput = useCallback(
    ({
      field: { ref: _ref, ...field },
    }: UseControllerReturn<TFieldValues, TName>) => {
      return <ListItemInput options={options} {...field} />;
    },
    [options]
  );
  return <ControlledField {...props} renderInput={renderInput} />;
};
