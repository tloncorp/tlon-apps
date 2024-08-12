import { SizableText } from 'tamagui';

import { WidgetPane } from './WidgetPane';

export function BioDisplay({ bio }: { bio: string }) {
  return (
    <WidgetPane>
      <WidgetPane.Title>About</WidgetPane.Title>
      <SizableText>{bio.length ? bio : 'An enigma'}</SizableText>
    </WidgetPane>
  );
}
