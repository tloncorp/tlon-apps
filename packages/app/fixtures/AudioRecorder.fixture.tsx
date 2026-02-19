import { ComponentRef, useRef, useState } from 'react';
import { useFixtureSelect } from 'react-cosmos/client';
import { Button } from 'react-native';

import {
  AudioRecorder,
  AudioRecorderSheet,
} from '../ui/components/AudioRecorder';
import { Waveform } from '../ui/components/AudioRecorder/Waveform';
import { FixtureWrapper } from './FixtureWrapper';

export default function AudioRecorderFixture() {
  const ref = useRef<ComponentRef<typeof AudioRecorder>>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [overrideAvailability] = useFixtureSelect('Override availability', {
    options: ['Default', 'Available', 'Unavailable'],
    defaultValue: 'Default',
  });

  const audioRecorderRef = useRef<ComponentRef<typeof AudioRecorder> | null>(
    null
  );

  const [waveformValues, setWaveformValues] = useState<number[] | null>(null);

  return (
    <>
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
        {waveformValues && (
          <Waveform
            values={waveformValues}
            style={{ height: 46, alignSelf: 'stretch' }}
          />
        )}

        <Button
          title="Toggle modal"
          onPress={() => {
            setWaveformValues(null);
            setIsSheetOpen((x) => !x);
          }}
        />
      </FixtureWrapper>
      <AudioRecorderSheet
        open={isSheetOpen}
        disableDrag
        snapPointsMode="fit"
        audioRecorderProps={{
          startInRecordingMode: true,
          paddingBottom: 50,
          onSubmit({ waveformPreview }) {
            setWaveformValues(waveformPreview ?? null);
            setIsSheetOpen(false);
          },
          onCancel() {
            setIsSheetOpen(false);
          },
          ref: audioRecorderRef,
        }}
      />
    </>
  );
}
