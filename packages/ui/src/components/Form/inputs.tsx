import React, { ComponentProps, ReactElement } from 'react';
import { TextInput as BaseTextInput } from 'react-native';
import { View, XStack, YStack, styled } from 'tamagui';

import { Icon, IconType } from '../Icon';
import { ListItem } from '../ListItem';
import { useBoundHandler } from '../ListItem/listItemUtils';
import { LabelText } from '../TrimmedText';
import { FieldContext } from './Form';

// Text input

export const TextInput = React.memo(
  styled(
    BaseTextInput,
    {
      context: FieldContext,
      borderRadius: '$l',
      borderWidth: 1,
      borderColor: '$shadow',
      placeholderTextColor: '$tertiaryText',
      fontSize: '$l',
      padding: '$xl',
      fontFamily: '$body',
      textAlignVertical: 'top',
      variants: {
        accent: {
          negative: {
            backgroundColor: '$negativeBackground',
            color: '$negativeActionText',
            borderColor: '$negativeBorder',
          },
        },
      },
    },
    {
      isInput: true,
      accept: {
        placeholderTextColor: 'color',
        selectionColor: 'color',
      } as const,
    }
  )
);

// Radio input

export type RadioInputOption<T> = {
  title: string;
  value: T;
  description?: string;
  disabled?: boolean;
};

export const RadioInput = <T,>({
  options,
  onChange,
  value,
  ...props
}: {
  options: {
    title: string;
    value: T;
    description?: string;
    disabled?: boolean;
  }[];
  value?: T;
  onChange?: (value: T) => void;
} & ComponentProps<typeof YStack>) => {
  return (
    <YStack {...props}>
      {options.map((option) => (
        <RadioInputRow
          key={option.title}
          option={option}
          onPress={onChange}
          checked={value === option.value}
        />
      ))}
    </YStack>
  );
};

const RadioInputRowFrame = styled(XStack, {
  gap: '$xl',
  paddingHorizontal: '$xl',
  paddingVertical: '$l',
  alignItems: 'center',
  borderRadius: '$l',
  variants: {
    disabled: {
      false: {
        pressStyle: {
          backgroundColor: '$secondaryBackground',
        },
      },
    },
  },
  defaultVariants: {
    disabled: false,
  },
});

/**
 * Single option row
 */
export function RadioInputRow<T>({
  option,
  onPress,
  checked,
}: {
  option: RadioInputOption<T>;
  onPress?: (value: T) => void;
  checked?: boolean;
} & Omit<ComponentProps<typeof RadioInputRowFrame>, 'onPress'>) {
  const handlePress = useBoundHandler(option.value, onPress);
  return (
    <RadioInputRowFrame
      onPress={option.disabled ? undefined : handlePress}
      disabled={!!option.disabled}
    >
      <RadioControl
        key={option.title}
        disabled={option.disabled}
        checked={checked}
      />
      <YStack gap="$l">
        <LabelText size="$xl" color="$primaryText">
          {option.title}
        </LabelText>
      </YStack>
    </RadioInputRowFrame>
  );
}

const RadioControlFrame = styled(View, {
  width: '$3xl',
  height: '$3xl',
  borderWidth: 1,
  borderRadius: 100,
  borderColor: '$shadow',
  alignItems: 'center',
  justifyContent: 'center',
  variants: {
    checked: {
      true: {
        backgroundColor: '$positiveActionText',
        borderColor: '$positiveActionText',
      },
    },
    disabled: {
      true: {
        backgroundColor: '$shadow',
      },
    },
  } as const,
});

/**
 * The actual little checkmark button
 */
export const RadioControl = RadioControlFrame.styleable<{ checked?: boolean }>(
  (props, ref) => {
    return (
      <RadioControlFrame {...props} ref={ref}>
        {props.checked ? <Icon color="$background" type="Checkmark" /> : null}
      </RadioControlFrame>
    );
  }
);

// List item input

export type ListItemInputOption<T> = {
  title: string;
  subtitle?: string;
  icon?: IconType | ReactElement;
  value: T;
  disabled?: boolean;
};

/**
 * Like RadioInput, but renders pickable list items
 */
export const ListItemInput = <T,>({
  options,
  onChange,
  value,
  ...props
}: {
  options: ListItemInputOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
} & ComponentProps<typeof YStack>) => {
  return (
    <YStack {...props}>
      {options.map((option) => (
        <ListItemInputRow
          key={option.title}
          option={option}
          onPress={onChange}
          checked={value === option.value}
        />
      ))}
    </YStack>
  );
};

function ListItemInputRow<T>({
  option,
  onPress,
  checked,
}: {
  option: ListItemInputOption<T>;
  onPress?: (value: T) => void;
  checked?: boolean;
}) {
  const handlePress = useBoundHandler(option.value, onPress);
  return (
    <ListItem onPress={handlePress}>
      {option.icon ? (
        typeof option.icon === 'string' ? (
          <ListItem.SystemIcon icon={option.icon} />
        ) : (
          option.icon
        )
      ) : null}
      <ListItem.MainContent>
        <ListItem.Title>{option.title}</ListItem.Title>
        {option.subtitle ? (
          <ListItem.Subtitle>{option.subtitle}</ListItem.Subtitle>
        ) : null}
      </ListItem.MainContent>
      <ListItem.EndContent padding={0}>
        {checked ? <RadioControl checked /> : null}
      </ListItem.EndContent>
    </ListItem>
  );
}
