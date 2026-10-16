import { poke } from '@tloncorp/api';
import { formatUd } from '@tloncorp/api/client/apiUtils';
import { createSectionId } from '@tloncorp/api/urbit';

import type { GroupSectionsDeps } from './commands/group-sections';
import {
  assertActingShipCanAdminister,
  getRawGroupForAdminVerification,
  verifyRawGroupState,
} from './group-admin';

export function createGroupSectionsDeps(): GroupSectionsDeps {
  return {
    assertCanAdminister: assertActingShipCanAdminister,
    getRawGroup: getRawGroupForAdminVerification,
    verify: verifyRawGroupState,
    pokeGroupAction: async (json) => {
      await poke({ app: 'groups', mark: 'group-action-5', json });
    },
    createSectionId,
    // `%move-nest` parses idx as a `@ud` string ("1.000"), not a JSON number.
    formatUd: (value) => formatUd(value),
    log: (line) => console.log(line),
  };
}
