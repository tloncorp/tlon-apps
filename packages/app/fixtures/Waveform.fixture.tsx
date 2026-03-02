import { useEffect, useState } from 'react';

import { Waveform } from '../ui/components/AudioRecorder/Waveform';
import { FixtureWrapper } from './FixtureWrapper';

export default function WaveformFixture() {
  const [values, setValues] = useState([
    0.2, 0.4, 0.6, 0.8, 1, 0.8, 0.6, 0.4, 0.2, 0,
  ]);

  useEffect(() => {
    const i = setInterval(() => {
      setValues((prevValues) => [...prevValues, Math.random()]);
    }, 100);
    return () => clearInterval(i);
  }, []);

  return (
    <FixtureWrapper horizontalAlign="center" verticalAlign="center">
      <Waveform
        style={{
          width: 300,
          height: 100,
          backgroundColor: '#eee',
        }}
        values={values}
        visualRange={[0, 1]}
        candleWidth={3}
      />
    </FixtureWrapper>
  );
}
