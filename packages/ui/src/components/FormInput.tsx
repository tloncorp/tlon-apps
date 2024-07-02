import {
  Control,
  Controller,
  DeepMap,
  FieldError,
  RegisterOptions,
} from 'react-hook-form';

import { Text, View, YStack } from '../core';
import { Input } from './Input';

export function FormInput({
  name,
  label,
  control,
  errors,
  rules,
  placeholder,
}: {
  name: string;
  label: string;
  control: Control<any>;
  errors: DeepMap<any, FieldError>;
  rules?: Omit<
    RegisterOptions<any, string>,
    'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'
  >;
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
            <Input height="$4xl" padding="$xl" size="$m">
              <Input.Area
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                placeholder={placeholder}
                aria-label={label}
              />
            </Input>
          </View>
        )}
      />
      {errors[name] && <Text color="$red">{errors[name].message}</Text>}
    </YStack>
  );
}
