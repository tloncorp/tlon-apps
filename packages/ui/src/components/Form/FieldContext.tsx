import { createStyledContext } from 'tamagui';

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
