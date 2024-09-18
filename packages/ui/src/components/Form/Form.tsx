import React from 'react';
import { ViewStyle, YStack, createStyledContext, styled } from 'tamagui';

import { Text } from '../TextV2';

// Top level form

export type Accent = 'positive' | 'negative' | 'neutral';

export const FormFrame = styled(YStack, {
  padding: '$2xl',
  gap: '$2xl',
});

// Single field

export const FieldContext = createStyledContext<{ accent?: Accent }>({
  accent: 'neutral',
});

export const FieldFrame = styled(YStack, {
  context: FieldContext,
  variants: {
    accent: {},
  } as { accent: Record<Accent, ViewStyle> },
});

export const Field = React.memo(
  FieldFrame.styleable<{
    label?: string;
    error?: string;
    required?: boolean;
  }>(({ children, label, required, error, ...props }, ref) => {
    return (
      <FieldFrame {...props} ref={ref} accent={error ? 'negative' : 'neutral'}>
        {label ? (
          <FieldLabel>
            {label}
            {required ? '*' : null}
          </FieldLabel>
        ) : null}
        {children}
        {error && <FieldErrorMessage>{error}</FieldErrorMessage>}
      </FieldFrame>
    );
  })
);

export const FieldLabel = React.memo(
  styled(Text, {
    color: '$tertiaryText',
    size: '$label/m',
    paddingHorizontal: '$xl',
    paddingVertical: '$l',
  })
);

export const FieldErrorMessage = styled(FieldLabel, {
  color: '$negativeActionText',
});
