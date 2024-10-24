import { View } from 'tamagui';

import { RenderItemType } from '../contexts/componentsKits';
import { ChatAuthorRow } from './AuthorRow';

export const ColorPost: RenderItemType = (props) => {
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
      <View
        // @ts-expect-error user-defined color
        backgroundColor={props.post.textContent}
        height={140}
        width="100%"
        borderRadius="$m"
      ></View>
    </View>
  );
};
