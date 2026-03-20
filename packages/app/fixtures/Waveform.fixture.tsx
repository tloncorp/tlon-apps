import { useInterval } from '@tloncorp/shared/utils/useInterval';
import { useCallback, useState } from 'react';
import { useValue } from 'react-cosmos/client';

import { Waveform } from '../ui/components/AudioRecorder/Waveform';
import { FixtureWrapper } from './FixtureWrapper';

export default function WaveformFixture() {
  const [values, setValues] = useState([
    0.2, 0.4, 0.6, 0.8, 1, 0.8, 0.6, 0.4, 0.2, 0,
  ]);
  const [candlePlaybackPosition, setCandlePlaybackPosition] = useState(0);

  const [growWaveform] = useValue('growWaveform', { defaultValue: false });
  const [playing] = useValue('playing', { defaultValue: false });

  useInterval(
    useCallback(() => {
      setValues((prevValues) => [...prevValues, Math.random()]);
    }, []),
    100,
    growWaveform
  );
  useInterval(
    useCallback(() => {
      setCandlePlaybackPosition((prev) => prev + 1);
    }, []),
    411,
    playing
  );

  return (
    <FixtureWrapper horizontalAlign="center" verticalAlign="center">
      <Waveform
        style={{
          width: 300,
          height: 100,
        }}
        values={values}
        visualRange={[0, 1]}
        candleWidth={3}
        candlePlaybackPosition={candlePlaybackPosition}
      />
    </FixtureWrapper>
  );
}
