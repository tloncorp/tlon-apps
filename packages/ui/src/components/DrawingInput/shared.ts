import type { ComponentType } from 'react';

import type { DraftInputContext } from '../draftInputs';

export type DrawingInputComponent = ComponentType<{
  draftInputContext: DraftInputContext;
}>;
