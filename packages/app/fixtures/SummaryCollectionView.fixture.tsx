import * as db from '@tloncorp/shared/db';
import { BaseSummaryCollectionView } from '../ui';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createFakePosts } from './fakeData';

export default function BaseSummaryCollectionViewFixture() {
  const [items] = useState<Array<db.Post>>(() => createFakePosts(10));

  return (
    <SafeAreaView>
      <BaseSummaryCollectionView items={items} />
    </SafeAreaView>
  );
}
