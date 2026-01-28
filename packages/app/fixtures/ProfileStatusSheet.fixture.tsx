import { useState } from 'react';

import { Button, View } from '../ui';
import ProfileStatusSheet from '../ui/components/ProfileStatusSheet';
import { FixtureWrapper } from './FixtureWrapper';

function ProfileStatusSheetFixture() {
  const [open, setOpen] = useState(true);

  return (
    <View flex={1} alignItems="center" justifyContent="center">
      <Button
        fill="outline"
        type="primary"
        onPress={() => setOpen(true)}
        label="Open Status Sheet"
      />
      <ProfileStatusSheet
        open={open}
        onOpenChange={setOpen}
        onUpdateStatus={(status) => console.log('Status updated:', status)}
      />
    </View>
  );
}

export default (
  <FixtureWrapper fillWidth fillHeight>
    <ProfileStatusSheetFixture />
  </FixtureWrapper>
);
