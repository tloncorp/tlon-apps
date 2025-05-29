import * as db from '@tloncorp/shared/db';

import { AppDataContextProvider, RequestsProvider } from '../../ui';
import { PostScreenView } from '../../ui';
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
            channel={channel}
            onPressRetry={async () => {}}
            onPressDelete={() => {}}
            groupMembers={[]}
            negotiationMatch={true}
            editPost={async () => {}}
            goBack={() => {}}
            handleGoToUserProfile={() => {}}
            onGroupAction={() => {}}
            goToDm={() => {}}
          />
        </RequestsProvider>
      </AppDataContextProvider>
    </FixtureWrapper>
  );
};
