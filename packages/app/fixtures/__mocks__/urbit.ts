// We're importing the `scry` that we're mocking below - why isn't this a
// circular import (i.e. importing this very file)?
//
// We're importing via through the `api/index.ts` file, which does not hit the
// mock resolution. (If we somehow imported from `@tloncorp/shared/api/urbit.ts`,
// we would have a circular import.) Tricky!
import type { scry as originalScry } from '@tloncorp/shared/api';

import { createMockedFunction } from './mock';

export const getCurrentUserId = createMockedFunction(() => '~zod');
export const scry = createMockedFunction<typeof originalScry>();
