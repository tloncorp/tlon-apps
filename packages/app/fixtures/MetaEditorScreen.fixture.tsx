import type * as db from '@tloncorp/shared/db';
import type { ComponentProps } from 'react';

import { AttachmentProvider, MetaEditorScreenView } from '../ui';
import { gardenClub } from './ChatDetails.fixture';
import { NativeScreenFixture } from './NativeScreenFixture';
import { danContact, tlonLocalIntros } from './fakeData';

const noop = () => {};
const online = { complete: true, status: 'yes' } as const;

const groupChat: db.Channel = {
  ...tlonLocalIntros,
  id: '0v4.00000.qd4mk.d4htu.er4b8.eao21',
  type: 'groupDm',
  groupId: null,
  title: 'Weekend plans',
  description: '',
  iconImage: null,
};

function Editor({
  canUpload = true,
  ...props
}: Partial<ComponentProps<typeof MetaEditorScreenView>> & {
  canUpload?: boolean;
}) {
  return (
    <NativeScreenFixture>
      <AttachmentProvider canUpload={canUpload} uploadAsset={async () => {}}>
        <MetaEditorScreenView
          title="Edit group info"
          chat={gardenClub}
          currentUserId={danContact.id}
          hostStatus={online}
          onSubmit={noop}
          goBack={noop}
          {...props}
        />
      </AttachmentProvider>
    </NativeScreenFixture>
  );
}

export default {
  '1 · Group': <Editor />,
  '2 · No icon image': <Editor chat={{ ...gardenClub, iconImage: null }} />,
  '3 · Nothing filled in': (
    <Editor
      chat={{ ...gardenClub, title: '', description: '', iconImage: null }}
    />
  ),
  '4 · Host offline': (
    <Editor hostStatus={{ complete: true, status: 'no-our-planet' }} />
  ),
  '5 · Storage not set up': <Editor canUpload={false} />,
  '6 · Group chat': (
    <Editor title="Edit chat info" chat={groupChat} hostStatus={undefined} />
  ),
};
