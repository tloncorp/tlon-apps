import { ComponentRef, useRef } from 'react';
import { useFixtureSelect } from 'react-cosmos/client';

import { AudioRecorder } from '../ui/components/AudioRecorder';
import { FixtureWrapper } from './FixtureWrapper';

export default function AudioRecorderFixture() {
  const ref = useRef<ComponentRef<typeof AudioRecorder>>(null);
  const [overrideAvailability] = useFixtureSelect('Override availability', {
    options: ['Default', 'Available', 'Unavailable'],
    defaultValue: 'Default',
  });

  return (
    <FixtureWrapper horizontalAlign="center" verticalAlign="center">
      <AudioRecorder
        ref={ref}
        style={{ width: 300, height: 100 }}
        startInRecordingMode
        dangerouslyOverrideIsAudioAvailable={
          overrideAvailability === 'Available'
            ? true
            : overrideAvailability === 'Unavailable'
              ? false
              : undefined
        }
      />
    </FixtureWrapper>
  );
}
