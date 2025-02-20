import React, { useContext } from 'react';
import { YStack, styled } from 'tamagui';
import { createStyledContext } from 'tamagui';

import { VariantsFromStyledContext } from '../../types';
import { Text } from '../../tmp/components/TextV2';
import { FormContext } from './Form';
import { Accent, BackgroundType } from './formUtils';

// Single field
type FieldContextValue = {
  accent: Accent;
  disabled: boolean;
  backgroundType: BackgroundType;
};

export const FieldContext = createStyledContext<FieldContextValue>({
  accent: 'neutral',
  disabled: false,
  backgroundType: 'primary',
});

export const FieldFrame = styled(YStack, {
  context: FieldContext,
  variants: {
    accent: {},
  } as VariantsFromStyledContext<typeof FieldContext>,
});

export const Field = FieldFrame.styleable<{
  label?: string;
  error?: string;
  required?: boolean;
  renderInputContainer?: (props: {
    children: React.ReactNode;
  }) => React.ReactNode;
}>(
  (
    {
      children,
      label,
      required,
      error,
      renderInputContainer,
      backgroundType,
      ...props
    },
    ref
  ) => {
    const { backgroundType: formBackgroundType } = useContext(FormContext);

    return (
      <FieldFrame
        {...props}
        ref={ref}
        accent={error ? 'negative' : props.accent ? props.accent : 'neutral'}
        backgroundType={backgroundType ?? formBackgroundType}
      >
        {label ? (
          <FieldLabel>
            {label}
            {required ? '*' : null}
          </FieldLabel>
        ) : null}
        {renderInputContainer ? renderInputContainer({ children }) : children}
        {error && <FieldErrorMessage>{error}</FieldErrorMessage>}
      </FieldFrame>
    );
  },
  {
    staticConfig: {
      componentName: 'Field',
      memo: true,
    },
  }
);

export const FieldLabel = React.memo(
  styled(Text, {
    color: '$tertiaryText',
    size: '$label/m',
    paddingHorizontal: '$xl',
    paddingBottom: '$l',
  })
);

export const FieldErrorMessage = styled(FieldLabel, {
  color: '$negativeActionText',
  paddingTop: '$l',
});
