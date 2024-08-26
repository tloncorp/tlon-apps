import { GroupPrivacy } from '@tloncorp/shared/dist/db/schema';
import React from 'react';

import * as Form from './Form';

function GroupPrivacySelectorRaw(props: {
  currentValue: GroupPrivacy;
  onChange: (newValue: GroupPrivacy) => void;
}) {
  return (
    <Form.FormFrame>
      <Form.RadioInputRow
        option={{
          title: 'Public',
          value: 'public',
          description: 'Everyone can find and join',
        }}
        checked={props.currentValue === 'public'}
        onPress={props.onChange}
      />
      <Form.RadioInputRow
        option={{
          title: 'Private',
          value: 'private',
          description: 'New members require approval',
        }}
        checked={props.currentValue === 'private'}
        onPress={props.onChange}
      />
      <Form.RadioInputRow
        option={{
          title: 'Secret',
          value: 'secret',
          description: 'Invite-only',
        }}
        checked={props.currentValue === 'secret'}
        onPress={props.onChange}
      />
    </Form.FormFrame>
  );
}

export const GroupPrivacySelector = React.memo(GroupPrivacySelectorRaw);
