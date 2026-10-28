import { useState } from 'react';
import { Button } from '@tloncorp/ui';

import { MessageTextSelectionSheet } from '../ui/components/ChatMessage/MessageTextSelectionSheet';
import { FixtureWrapper } from './FixtureWrapper';
import { createFakePosts } from './fakeData';

const post = createFakePosts(1)[0];
const shortText = 'Ah amazing, this is great. Thank you so much Vince 🙏';
const longText = Array.from(
  { length: 30 },
  (_, i) =>
    `Paragraph ${i + 1}: Select any part of this message, including text across line breaks. Links like https://tlon.io, mentions like ~zod, and emoji 🙏 should remain copyable.`
).join('\n\n');

function SelectionFixture({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <FixtureWrapper fillHeight fillWidth>
      <Button label="Select text" onPress={() => setOpen(true)} />
      <MessageTextSelectionSheet
        post={post}
        text={text}
        open={open}
        onOpenChange={setOpen}
      />
    </FixtureWrapper>
  );
}

export default {
  short: <SelectionFixture text={shortText} />,
  long: <SelectionFixture text={longText} />,
};
