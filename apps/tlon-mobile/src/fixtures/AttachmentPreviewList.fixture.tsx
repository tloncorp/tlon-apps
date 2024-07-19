import { Attachment, AttachmentProvider } from '@tloncorp/ui';
import { AttachmentPreviewList } from '@tloncorp/ui/src/components/MessageInput/AttachmentPreviewList';
import React from 'react';

import { FixtureWrapper } from './FixtureWrapper';
import { createFakePosts } from './fakeData';

const posts = createFakePosts(100);

const attachment: Attachment = {
  type: 'reference',
  path: '/1/chan/~nibset-napwyn/intros/msg/~solfer-magfed-3mct56',
  reference: {
    type: 'reference',
    referenceType: 'channel',
    channelId: posts[0].channelId,
    postId: posts[0].id,
  },
};

export default (
  <FixtureWrapper fillWidth>
    <AttachmentProvider
      initialAttachments={[attachment, attachment, attachment, attachment]}
      uploadAsset={async () => {}}
      canUpload={true}
    >
      <AttachmentPreviewList />
    </AttachmentProvider>
  </FixtureWrapper>
);
