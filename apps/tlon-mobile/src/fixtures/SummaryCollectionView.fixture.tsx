import { BaseSummaryCollectionView } from '@tloncorp/ui';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

let titleCounter = 0;
let keyCounter = 0;
function makeCollectionItem(title: string = `Item ${titleCounter++}`) {
  return { key: (keyCounter++).toString(), title };
}

export default function BaseSummaryCollectionViewFixture() {
  const [item] = useState<Array<{ key: string; title: string }>>(() =>
    Array.from({ length: 10 }, () => makeCollectionItem())
  );

  return (
    <SafeAreaView>
      <BaseSummaryCollectionView items={item} />
    </SafeAreaView>
  );
}
