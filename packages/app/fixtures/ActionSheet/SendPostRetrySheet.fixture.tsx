import { SendPostRetrySheet } from '../../ui/src/components/SendPostRetrySheet';

import { createFakePost } from '../fakeData';

const post = createFakePost();

export default (
  <SendPostRetrySheet
    open={true}
    onOpenChange={() => {}}
    onPressDelete={() => {}}
    onPressRetry={() => {}}
    post={post}
  />
);
