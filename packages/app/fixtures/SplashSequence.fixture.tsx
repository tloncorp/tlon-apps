import { useFixtureSelect } from 'react-cosmos/client';
import React from 'react';

import { SplashSequence } from '../ui/components/Wayfinding/SplashSequence';
import { FixtureWrapper } from './FixtureWrapper';

function SplashSequenceFixture() {
  const [initialPane] = useFixtureSelect('initialPane', {
    options: ['Welcome', 'Group', 'Channels', 'Privacy', 'Invite'],
    defaultValue: 'Welcome',
  });

  const handleCompleted = React.useCallback(() => {
    console.log('Splash sequence completed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <SplashSequence onCompleted={handleCompleted} />
    </FixtureWrapper>
  );
}

export default {
  'Welcome Sequence': <SplashSequenceFixture />,
}; 