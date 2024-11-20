import { View } from 'tamagui';

import { RenderItemType } from '../contexts/componentsKits';
import { ChatAuthorRow } from './AuthorRow';

export const ColorPost: RenderItemType = (props) => {
  return (
    <View flex={1}>
      {props.showAuthor && (
        <ChatAuthorRow
          padding="$l"
          paddingBottom="$s"
          author={props.post.author}
          authorId={props.post.authorId}
        />
      )}
      <View
        // @ts-expect-error user-defined color
        backgroundColor={props.post.textContent}
        flex={1}
      ></View>
    </View>
  );
};
