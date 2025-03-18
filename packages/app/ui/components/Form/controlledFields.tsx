import React, { ComponentProps, useCallback } from 'react';
import {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
  UseControllerReturn,
  useController,
} from 'react-hook-form';

import { Field } from './Field';
import {
  ImageInput,
  ListItemInput,
  ListItemInputOption,
  RadioInput,
  RadioInputOption,
  TextInput,
} from './inputs';

type ControlledFieldProps<
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
  TInputProps extends object,
  TRequireInput = false,
> = ComponentProps<typeof Field> & {
  name: TName;
  control: Control<TFieldValues>;
  label?: string;
  rules?: RegisterOptions<TFieldValues, TName>;
  inputProps?: TInputProps;
  hideError?: boolean;
} & (TRequireInput extends true
    ? {
        renderInput: ControlledFieldRenderInput<TFieldValues, TName>;
      }
    : {
        renderInput?: ControlledFieldRenderInput<TFieldValues, TName>;
      });

type ControlledFieldRenderInput<
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
> = (controller: UseControllerReturn<TFieldValues, TName>) => React.ReactNode;

export const ControlledField = <
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
  TInputProps extends object,
>({
  name,
  label,
  control,
  rules,
  renderInput,
  hideError,
  ...props
}: ControlledFieldProps<TFieldValues, TName, TInputProps, true>) => {
  const controller = useController({
    name,
    control,
    rules,
  });
  return (
    <Field
      required={!!rules?.required}
      label={label}
      error={hideError ? undefined : controller.fieldState?.error?.message}
      {...props}
    >
      {renderInput(controller)}
    </Field>
  );
};

export const ControlledTextField = <
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
>(
  props: ControlledFieldProps<
    TFieldValues,
    TName,
    ComponentProps<typeof TextInput>
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
  return <ControlledField renderInput={renderInput} {...props} />;
};

export const ControlledTextareaField = <
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
>(
  props: ControlledFieldProps<
    TFieldValues,
    TName,
    ComponentProps<typeof TextInput>
  >
) => {
  const renderInput = useCallback(
    ({
      field: { onChange, ...field },
    }: UseControllerReturn<TFieldValues, TName>) => {
      return (
        <TextInput
          {...field}
          onChangeText={onChange}
          multiline={true}
          minHeight={128}
          {...props.inputProps}
        />
      );
    },
    [props.inputProps]
  );
  return <ControlledField {...props} renderInput={renderInput} />;
};

export const ControlledImageField = <
  TFieldValues extends FieldValues,
  TName extends Path<TFieldValues>,
>(
  props: ControlledFieldProps<
    TFieldValues,
    TName,
    ComponentProps<typeof ImageInput>
  >
) => {
  const renderInput = useCallback(
    ({
      field: {
        onChange,
        // we pull the ref off as this input doesn't support focus
        ref: _ref,
        ...field
      },
    }: UseControllerReturn<TFieldValues, TName>) => {
      return (
        <ImageInput {...field} onChange={onChange} {...props.inputProps} />
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
}: { options: RadioInputOption<TFieldValues[TName]>[] } & ControlledFieldProps<
  TFieldValues,
  TName,
  ComponentProps<typeof RadioInput>
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
}: {
  options: ListItemInputOption<TFieldValues[TName]>[];
} & ControlledFieldProps<
  TFieldValues,
  TName,
  ComponentProps<typeof ListItemInput>
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
