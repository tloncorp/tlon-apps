import { Attachment } from '@tloncorp/shared/domain';

import { AttachmentProvider } from '../ui';
import { AppDataContextProvider } from '../ui';
import { AttachmentPreviewList } from '../ui/components/MessageInput/AttachmentPreviewList';
import { FixtureWrapper } from './FixtureWrapper';
import {
  exampleContacts,
  referencedChatPost,
  referencedGalleryPost,
  referencedNotebookPost,
} from './contentHelpers';

const attachments: Attachment[] = [
  referencedChatPost,
  referencedGalleryPost,
  referencedNotebookPost,
].map((p) => {
  return {
    type: 'reference',
    path: '',
    reference: {
      type: 'reference',
      referenceType: 'channel',
      channelId: p.channelId,
      postId: p.id,
    },
  } as const;
});

export default (
  <FixtureWrapper fillWidth>
    <AppDataContextProvider contacts={Object.values(exampleContacts)}>
      <AttachmentProvider
        initialAttachments={attachments}
        uploadAsset={async () => {}}
        canUpload={true}
      >
        <AttachmentPreviewList />
      </AttachmentProvider>
    </AppDataContextProvider>
  </FixtureWrapper>
);
