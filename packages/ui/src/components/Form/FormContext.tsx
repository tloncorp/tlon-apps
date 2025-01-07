import { createStyledContext } from 'tamagui';

import { BackgroundType } from './formUtils';

export const FormContext = createStyledContext<{
  backgroundType: BackgroundType;
}>({ backgroundType: 'primary' });
