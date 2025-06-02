import { ListItem, View } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import {
  postWithDeleted,
  postWithHidden,
  postWithText,
} from './contentHelpers';
import { groupWithColorAndNoImage } from './fakeData';

// Create posts with different states for testing
const normalPost = {
  ...postWithText,
  authorId: '~ravmel-ropdyl',
  textContent: 'This is a normal post with text content',
  hidden: false,
  isDeleted: false,
};

const deletedPost = {
  ...postWithDeleted,
  authorId: '~solfer-magfed',
  textContent: 'This text should not show because post is deleted',
  hidden: false,
  isDeleted: true,
};

const hiddenPost = {
  ...postWithHidden,
  authorId: '~latter-bolden',
  textContent: 'This text should not show because post is hidden',
  hidden: true,
  isDeleted: false,
};

const deletedAndHiddenPost = {
  ...postWithDeleted,
  authorId: '~nocsyx-lassul',
  textContent: 'This should show as deleted (deleted takes priority)',
  hidden: true,
  isDeleted: true,
};

const emptyTextPost = {
  ...postWithText,
  authorId: '~palfun-foslup',
  textContent: null,
  hidden: false,
  isDeleted: false,
};

const PostPreviewItem = ({
  post,
  label,
  showAuthor = true,
}: {
  post: any;
  label: string;
  showAuthor?: boolean;
}) => (
  <View>
    <ListItem>
      <ListItem.GroupIcon model={groupWithColorAndNoImage} />
      <ListItem.MainContent>
        <ListItem.Title>{label}</ListItem.Title>
        <ListItem.PostPreview post={post} showAuthor={showAuthor} />
      </ListItem.MainContent>
    </ListItem>
  </View>
);

export default {
  basic: (
    <FixtureWrapper fillWidth innerBackgroundColor="$secondaryBackground">
      <View gap="$s" paddingHorizontal="$l">
        <PostPreviewItem post={normalPost} label="Normal Post" />
        <PostPreviewItem post={deletedPost} label="Deleted Post" />
        <PostPreviewItem post={hiddenPost} label="Hidden Post" />
        <PostPreviewItem
          post={deletedAndHiddenPost}
          label="Deleted + Hidden Post"
        />
        <PostPreviewItem post={emptyTextPost} label="Empty Text Post" />
      </View>
    </FixtureWrapper>
  ),

  withoutAuthor: (
    <FixtureWrapper fillWidth innerBackgroundColor="$secondaryBackground">
      <View gap="$s" paddingHorizontal="$l">
        <PostPreviewItem
          post={normalPost}
          label="Normal Post"
          showAuthor={false}
        />
        <PostPreviewItem
          post={deletedPost}
          label="Deleted Post"
          showAuthor={false}
        />
        <PostPreviewItem
          post={hiddenPost}
          label="Hidden Post"
          showAuthor={false}
        />
        <PostPreviewItem
          post={deletedAndHiddenPost}
          label="Deleted + Hidden Post"
          showAuthor={false}
        />
        <PostPreviewItem
          post={emptyTextPost}
          label="Empty Text Post"
          showAuthor={false}
        />
      </View>
    </FixtureWrapper>
  ),

  priorityTest: (
    <FixtureWrapper fillWidth innerBackgroundColor="$secondaryBackground">
      <View gap="$s" paddingHorizontal="$l">
        <PostPreviewItem post={normalPost} label="Normal: Shows content" />
        <PostPreviewItem
          post={hiddenPost}
          label="Hidden: Shows '(Hidden post)'"
        />
        <PostPreviewItem
          post={deletedPost}
          label="Deleted: Shows '(Deleted post)'"
        />
        <PostPreviewItem
          post={deletedAndHiddenPost}
          label="Both: Deleted takes priority"
        />
      </View>
    </FixtureWrapper>
  ),
};
