import * as db from '@tloncorp/shared/dist/db';
import { AppDataContextProvider, RequestsProvider } from '@tloncorp/ui';
import { PostScreenView } from '@tloncorp/ui/src';

import { FixtureWrapper } from '../FixtureWrapper';
import * as content from '../contentHelpers';
import { createFakePosts, tlonLocalGettingStarted } from '../fakeData';

const replies = createFakePosts(10, 'reply');

const replyData = {
  replyCount: replies.length,
  replyContactIds: replies.slice(0, 3).map((r) => r.authorId),
  replyTime: replies[0].sentAt,
};

export const DetailViewFixture = ({
  post,
  channel = tlonLocalGettingStarted,
}: {
  post: db.Post;
  channel?: db.Channel;
}) => {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider contacts={Object.values(content.exampleContacts)}>
        <RequestsProvider
          useChannel={content.useChannel}
          useGroup={content.useGroup}
          usePost={content.usePost}
          usePostReference={content.usePostReference}
          useApp={() => {}}
        >
          <PostScreenView
            parentPost={{
              ...post,
              ...replyData,
              channelId: channel.id,
              channel,
            }}
            posts={replies}
            isLoadingPosts={false}
            channel={channel}
            sendReply={async () => {}}
            onPressRetry={() => {}}
            onPressDelete={() => {}}
            groupMembers={[]}
            negotiationMatch={true}
            editPost={async () => {}}
            uploadAsset={async () => {}}
            storeDraft={() => {}}
            clearDraft={() => {}}
            getDraft={async () => ({})}
            goBack={() => {}}
            markRead={() => {}}
            canUpload={true}
            handleGoToUserProfile={() => {}}
            headerMode="default"
          />
        </RequestsProvider>
      </AppDataContextProvider>
    </FixtureWrapper>
  );
};
