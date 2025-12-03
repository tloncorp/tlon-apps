import { convertContent } from '@tloncorp/shared';
import { ScrollView } from 'tamagui';

import { NotebookContentRenderer } from '../ui/components/NotebookPost/NotebookPost';
import { FixtureWrapper } from './FixtureWrapper';
import { postWithEverything as post } from './contentHelpers';

export default {
  NotebookContentRenderer: () => {
    return (
      <FixtureWrapper fillWidth safeArea>
        <ScrollView automaticallyAdjustContentInsets>
          <NotebookContentRenderer
            marginTop="$-l"
            marginHorizontal="$-l"
            paddingHorizontal="$xl"
            content={convertContent(post.content, post.blob)}
          />
        </ScrollView>
      </FixtureWrapper>
    );
  },
};
