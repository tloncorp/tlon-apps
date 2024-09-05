import * as db from '@tloncorp/shared/dist/db';
import { AppDataContextProvider, RequestsProvider } from '@tloncorp/ui';
import { PostScreenView } from '@tloncorp/ui/src';

import { FixtureWrapper } from '../FixtureWrapper';
import * as content from '../contentHelpers';
import { postWithLink, postWithLongNote } from '../contentHelpers';
import { createFakePosts, tlonLocalGettingStarted } from '../fakeData';

const {
  postWithChatReference,
  postWithGalleryReference,
  postWithNotebookReference,
  postWithCode,
  postWithImage,
  postWithVideo,
  postWithBlockquote,
  postWithGroupReference,
  postWithGroupReferenceNoAvatar,
  postWithImageAndText,
  postWithList,
  postWithMention,
  postWithText,
  postWithEmoji,
  postWithSingleEmoji,
  postWithDeleted,
  postWithHidden,
} = content;

const replies = createFakePosts(10, 'reply');

const replyData = {
  replyCount: replies.length,
  replyContactIds: replies.slice(0, 3).map((r) => r.authorId),
  replyTime: replies[0].sentAt,
};

const DetailViewFixture = ({
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
            channel={channel}
            currentUserId={post.authorId}
            sendReply={async () => {}}
            onPressRetry={() => {}}
            onPressDelete={() => {}}
            groupMembers={[]}
            contacts={[]}
            negotiationMatch={true}
            editPost={async () => {}}
            uploadAsset={async () => {}}
            storeDraft={() => {}}
            clearDraft={() => {}}
            getDraft={async () => ({})}
            goBack={() => {}}
            markRead={() => {}}
            canUpload={true}
          />
        </RequestsProvider>
      </AppDataContextProvider>
    </FixtureWrapper>
  );
};

export function createFixtureSet(channel: db.Channel) {
  return {
    ChatReference: (
      <DetailViewFixture
        channel={channel}
        post={{ ...postWithChatReference, title: 'Whaaaa' }}
      />
    ),
    GalleryReference: (
      <DetailViewFixture channel={channel} post={postWithGalleryReference} />
    ),
    NotebookReference: (
      <DetailViewFixture channel={channel} post={postWithNotebookReference} />
    ),
    Code: <DetailViewFixture channel={channel} post={postWithCode} />,
    Image: <DetailViewFixture channel={channel} post={postWithImage} />,
    Video: <DetailViewFixture channel={channel} post={postWithVideo} />,
    Blockquote: (
      <DetailViewFixture channel={channel} post={postWithBlockquote} />
    ),
    GroupReference: (
      <DetailViewFixture channel={channel} post={postWithGroupReference} />
    ),
    GroupReferenceNoAvatar: (
      <DetailViewFixture
        channel={channel}
        post={postWithGroupReferenceNoAvatar}
      />
    ),
    ImageAndText: (
      <DetailViewFixture channel={channel} post={postWithImageAndText} />
    ),
    List: <DetailViewFixture channel={channel} post={postWithList} />,
    Mention: <DetailViewFixture channel={channel} post={postWithMention} />,
    Text: <DetailViewFixture channel={channel} post={postWithText} />,
    Emoji: <DetailViewFixture channel={channel} post={postWithEmoji} />,
    SingleEmoji: (
      <DetailViewFixture channel={channel} post={postWithSingleEmoji} />
    ),
    Deleted: <DetailViewFixture channel={channel} post={postWithDeleted} />,
    Hidden: <DetailViewFixture channel={channel} post={postWithHidden} />,
    Link: <DetailViewFixture channel={channel} post={postWithLink} />,
    Note: <DetailViewFixture channel={channel} post={postWithLongNote} />,
  };
}
