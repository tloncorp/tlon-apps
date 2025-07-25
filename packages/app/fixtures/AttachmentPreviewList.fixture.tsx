import { Attachment } from '@tloncorp/shared/domain';

import { AttachmentProvider } from '../ui';
import { AppDataContextProvider, RequestsProvider } from '../ui';
import { AttachmentPreviewList } from '../ui/components/MessageInput/AttachmentPreviewList';
import { FixtureWrapper } from './FixtureWrapper';
import {
  exampleContacts,
  referencedChatPost,
  referencedGalleryPost,
  referencedNotebookPost,
  useApp,
  useChannel,
  useGroup,
  usePost,
  usePostReference,
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
      <RequestsProvider
        useChannel={useChannel}
        useGroup={useGroup}
        usePost={usePost}
        usePostReference={usePostReference}
        useApp={useApp}
      >
        <AttachmentProvider
          initialAttachments={attachments}
          uploadAsset={async () => {}}
          canUpload={true}
        >
          <AttachmentPreviewList />
        </AttachmentProvider>
      </RequestsProvider>
    </AppDataContextProvider>
  </FixtureWrapper>
);
