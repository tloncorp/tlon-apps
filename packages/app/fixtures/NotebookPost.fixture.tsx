import { convertContent } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from 'tamagui';

import { AppDataContextProvider, RequestsProvider, View } from '../ui';
import {
  NotebookContentRenderer,
  NotebookPost,
} from '../ui/components/NotebookPost/NotebookPost';
import { FixtureWrapper } from './FixtureWrapper';
import * as content from './contentHelpers';
import { postWithEverything as post } from './contentHelpers';

const NotebookPostSpecimen = ({
  label,
  post,
  onPressRetry,
}: {
  label: string;
  post: db.Post;
  onPressRetry?: (post: db.Post) => Promise<void>;
}) => {
  return (
    <View padding="$m" gap="$m" backgroundColor="$secondaryBackground">
      <Text size="$label/s">{label}</Text>
      <View backgroundColor="$background" borderRadius="$l">
        <NotebookPost post={post} onPressRetry={onPressRetry} />
      </View>
    </View>
  );
};

const PostVariantsFixture = ({ post }: { post: db.Post }) => {
  const insets = useSafeAreaInsets();
  return (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider contacts={Object.values(content.exampleContacts)}>
        <RequestsProvider
          usePost={content.usePost}
          useApp={content.useApp}
          useChannel={content.useChannel}
          useGroup={content.useGroup}
          usePostReference={content.usePostReference}
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top,
              paddingHorizontal: 12,
              paddingBottom: insets.bottom,
              gap: 12,
            }}
          >
            <NotebookPostSpecimen label="Default" post={post} />
            <NotebookPostSpecimen
              label="Pending"
              post={{ ...post, deliveryStatus: 'pending' }}
            />
            <NotebookPostSpecimen
              label="Failed"
              post={{ ...post, deliveryStatus: 'failed' }}
              onPressRetry={async (p) => {
                alert(`Retry triggered for post: ${p.id}`);
              }}
            />
            <NotebookPostSpecimen
              label="Sent"
              post={{ ...post, deliveryStatus: 'sent' }}
            />
            <NotebookPostSpecimen
              label="Edited"
              post={{ ...post, isEdited: true }}
            />
            <NotebookPostSpecimen
              label="Hidden"
              post={{ ...post, hidden: true }}
            />
          </ScrollView>
        </RequestsProvider>
      </AppDataContextProvider>
    </FixtureWrapper>
  );
};

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
  DeliveryStates: <PostVariantsFixture post={content.postWithText} />,
};
