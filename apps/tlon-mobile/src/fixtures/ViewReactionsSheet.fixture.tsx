import { ViewReactionsSheet } from 'packages/ui/src/components/ChatMessage/ViewReactionsSheet';

import { createFakePosts } from './fakeData';

const posts = createFakePosts(3);
const post = posts[0];
const secondPost = posts[1];

export default {
  many: <ViewReactionsSheet post={post} open={true} onOpenChange={() => {}} />,
  few: (
    <ViewReactionsSheet post={secondPost} open={true} onOpenChange={() => {}} />
  ),
};
