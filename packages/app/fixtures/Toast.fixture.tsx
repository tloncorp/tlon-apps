import { Button, View, useToast } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';

function ToastFixture() {
  const showToast = useToast();

  return (
    <View flex={1} alignItems="center" justifyContent="center" gap="$l">
      <Button onPress={() => showToast({ message: 'Info Toast' })}>
        <Button.Text>Show toast</Button.Text>
      </Button>
      <Button
        onPress={() =>
          showToast({
            message:
              'This toast has a lot of content it really just keeps going on and on',
          })
        }
      >
        <Button.Text>Show long toast</Button.Text>
      </Button>
      <Button
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
      >
        <Button.Text>Enqueue 3 Toasts</Button.Text>
      </Button>
    </View>
  );
}

export default (
  <FixtureWrapper fillHeight fillWidth>
    <ToastFixture />
  </FixtureWrapper>
);
