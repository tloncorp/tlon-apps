import { ChatMessage } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import {
  createBlockquoteContent,
  createContentWithMention,
  createFakePost,
} from './fakeData';

const fakeMentionContent = createContentWithMention('yo', '~bus');
const fakeMentionPost = createFakePost('chat', fakeMentionContent);
const fakeBlockQuoteContent = createBlockquoteContent(
  'Velit mollit veniam ad duis id deserunt aute. Irure duis consectetur proident voluptate. Deserunt adipisicing ullamco ex nisi cupidatat cillum enim. Reprehenderit velit non esse ad. Ut id ex incididunt laboris sunt eiusmod ullamco deserunt cillum enim in velit commodo. Culpa magna reprehenderit proident. Reprehenderit consequat sunt dolore aute sunt. Culpa officia nisi adipisicing eu ullamco eu velit dolore.',
  'wtf are you talking about'
);
const fakeBlockQuotePost = createFakePost('chat', fakeBlockQuoteContent);

const ChatMessageFixtureWithMention = () => (
  <FixtureWrapper fillWidth>
    <ChatMessage post={fakeMentionPost} currentUserId="~zod" />
  </FixtureWrapper>
);

const ChatMessageFixtureWithBlockQuote = () => (
  <FixtureWrapper fillWidth>
    <ChatMessage post={fakeBlockQuotePost} currentUserId="~zod" />
  </FixtureWrapper>
);

export default {
  withMention: ChatMessageFixtureWithMention,
  withBlockQuote: ChatMessageFixtureWithBlockQuote,
};
