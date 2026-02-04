import { Button, Text } from '@tloncorp/ui';
import { useState } from 'react';

import AttachmentSheet from '../../ui/components/AttachmentSheet';
import { FixtureWrapper } from '../FixtureWrapper';

export default function AttachmentSheetFixture() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <FixtureWrapper>
      <Button
        label={isOpen ? '(Sheet is open)' : 'Open Sheet'}
        onPress={() => {
          setIsOpen((x) => !x);
        }}
      />
      <AttachmentSheet
        onOpenChange={setIsOpen}
        isOpen={isOpen}
        mediaType="all"
      />
    </FixtureWrapper>
  );
}
