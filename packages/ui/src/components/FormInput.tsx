import { ComponentProps } from 'react';
import {
  Control,
  Controller,
  DeepMap,
  FieldError,
  RegisterOptions,
} from 'react-hook-form';
import { createStyledContext, styled, withStaticProperties } from 'tamagui';
import { SizableText, Text, View, YStack } from 'tamagui';

import { Input } from './Input';

export function FormInput({
  name,
  label,
  control,
  errors,
  rules,
  placeholder,
  frameProps,
  areaProps,
}: {
  name: string;
  label: string;
  control: Control<any>;
  errors: DeepMap<any, FieldError>;
  rules?: Omit<
    RegisterOptions<any, string>,
    'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'
  >;
  frameProps?: ComponentProps<typeof Input>;
  areaProps?: ComponentProps<typeof Input.Area>;
  placeholder?: string;
}) {
  return (
    <YStack width="100%" gap="$s">
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field: { onChange, onBlur, value } }) => (
          <View width="100%">
            <Input height="$4xl" padding="$xl" size="$m" {...frameProps}>
              <Input.Area
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                placeholder={placeholder}
                aria-label={label}
                {...areaProps}
              />
            </Input>
          </View>
        )}
      />
      {errors[name] && <Text color="$red">{errors[name].message}</Text>}
    </YStack>
  );
}

export const FormInputContext = createStyledContext<{
  name: string;
  control: Control<any>;
}>();

const FormInputFrame = styled(YStack, {
  context: FormInputContext,
  padding: '$m',
});

const FormLabel = styled(SizableText, {
  context: FormInputContext,
  color: '$secondaryText',
  fontSize: '$s',
});

const FormErrors = (props: { errors: DeepMap<any, FieldError> }) => {
  const context = FormInputContext.useStyledContext();
  if (!props.errors[context.name]) {
    return null;
  }

  return (
    <View>
      <SizableText color="$negativeActionText">
        {props.errors[context.name].message}
      </SizableText>
    </View>
  );
};

export const FormTextInput = withStaticProperties(FormInputFrame, {
  Input: FormInput,
  Label: FormLabel,
  Error: FormErrors,
});
