import React from 'react';
import {styled} from 'tamagui';
import {Stack} from './core';

const RadioToggleDot = styled(Stack, {
  flex: 1,
  borderRadius: 100,
  margin: '$xs',
  backgroundColor: '$color',
});

const RadioToggleFrame = styled(Stack, {
  width: '$m',
  height: '$m',
  borderRadius: 100,
  borderColor: '$color',
  borderWidth: 2,
});

export const RadioToggle = RadioToggleFrame.styleable<{isChecked: boolean}>(
  ({isChecked, ...props}, ref) => {
    return (
      <RadioToggleFrame {...props} ref={ref}>
        {isChecked && <RadioToggleDot />}
      </RadioToggleFrame>
    );
  },
);
