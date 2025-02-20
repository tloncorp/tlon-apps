import { View } from 'tamagui';

import { RenderItemType } from '../contexts/componentsKits';
import { ChatAuthorRow } from './AuthorRow';
import { createContentRenderer } from './PostContent';
import { usePostContent } from './PostContent/contentUtils';
import { RawText } from '../tmp/components/TextV2';

export const YellPost: RenderItemType = (props) => {
  const content = usePostContent(props.post);

  return (
    <View width="100%" paddingBottom="$m">
      {props.showAuthor && (
        <ChatAuthorRow
          padding="$l"
          paddingBottom="$s"
          author={props.post.author}
          authorId={props.post.authorId}
        />
      )}
      <YellContentRenderer
        content={content}
        isNotice={props.post.type === 'notice'}
      />
    </View>
  );
};

const YellContentRenderer = createContentRenderer({
  inlineRenderers: {
    text: (props) => {
      return (
        <RawText fontSize={44} lineHeight={44} fontWeight={'500'}>
          {props.inline.text.toUpperCase()}
        </RawText>
      );
    },
  },
});
