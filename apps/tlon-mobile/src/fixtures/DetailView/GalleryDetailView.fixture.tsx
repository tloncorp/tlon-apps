import {
  postWithBlockquote,
  postWithChatReference,
  postWithCode,
  postWithDeleted,
  postWithEmoji,
  postWithGalleryReference,
  postWithGroupReference,
  postWithGroupReferenceNoAvatar,
  postWithHidden,
  postWithImage,
  postWithImageAndText,
  postWithLink,
  postWithList,
  postWithLongNote,
  postWithMention,
  postWithNotebookReference,
  postWithSingleEmoji,
  postWithText,
  postWithVideo,
} from '../contentHelpers';
import { tlonLocalCommunityCatalog } from '../fakeData';
import { DetailViewFixture } from './detailViewFixtureBase';

const channel = tlonLocalCommunityCatalog;

export default {
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
  Blockquote: <DetailViewFixture channel={channel} post={postWithBlockquote} />,
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
