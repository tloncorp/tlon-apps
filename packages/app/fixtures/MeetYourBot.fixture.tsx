import { useEffect, useState } from 'react';
import { useValue } from 'react-cosmos/client';
import { LogBox } from 'react-native';

import { MeetYourBotPane } from '../ui/components/Wayfinding/MeetYourBot/MeetYourBotPane';
import { FixtureWrapper } from './FixtureWrapper';

// The wrapper's test node client logs this when fixtures switch; it is not
// about these slides, and its toast covers the button.
LogBox.ignoreLogs(['Failed to DELETE channel']);

function SlideOneFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <MeetYourBotPane ready={false} onStartChatting={() => {}} />
    </FixtureWrapper>
  );
}

function SlideTwoSettingUpFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <MeetYourBotPane
        initialSlide={2}
        ready={false}
        onStartChatting={() => {}}
      />
    </FixtureWrapper>
  );
}

function SlideTwoReadyFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <MeetYourBotPane initialSlide={2} ready onStartChatting={() => {}} />
    </FixtureWrapper>
  );
}

// Walk through it as a new user would: the chat becomes ready a few seconds
// in, and Start chatting starts over so it can be replayed.
function FlowFixture() {
  const [readyAfterSeconds] = useValue('Ready after (seconds)', {
    defaultValue: 8,
  });
  const [run, setRun] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const timer = setTimeout(() => setReady(true), readyAfterSeconds * 1000);
    return () => clearTimeout(timer);
  }, [readyAfterSeconds, run]);
  return (
    <FixtureWrapper fillWidth fillHeight>
      <MeetYourBotPane
        key={run}
        ready={ready}
        onStartChatting={() => setRun((value) => value + 1)}
      />
    </FixtureWrapper>
  );
}

export default {
  Flow: <FlowFixture />,
  'Slide 1': <SlideOneFixture />,
  'Slide 2, setting up': <SlideTwoSettingUpFixture />,
  'Slide 2, ready': <SlideTwoReadyFixture />,
};
