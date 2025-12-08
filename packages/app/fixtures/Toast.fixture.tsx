import { Button, View, useToast } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';

function ToastFixture() {
  const showToast = useToast();

  return (
    <View flex={1} alignItems="center" justifyContent="center" gap="$l">
      <Button fill="outline" type="primary" onPress={() => showToast({ message: 'Info Toast' })} label="Show toast" />
      <Button
        fill="outline"
        type="primary"
        onPress={() =>
          showToast({
            message:
              'This toast has a lot of content it really just keeps going on and on',
          })
        }
        label="Show long toast"
      />
      <Button
        fill="outline"
        type="primary"
        onPress={() => {
          showToast({ message: 'First Toast', duration: 1500 });
          showToast({
            message: 'Second Toast',
            duration: 1500,
          });
          showToast({
            message: 'Third Toast',
            duration: 1500,
          });
        }}
        label="Enqueue 3 Toasts"
      />
    </View>
  );
}

export default (
  <FixtureWrapper fillHeight fillWidth>
    <ToastFixture />
  </FixtureWrapper>
);
