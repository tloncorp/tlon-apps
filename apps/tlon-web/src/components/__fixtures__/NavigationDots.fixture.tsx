import { useValue } from 'react-cosmos/client';

import NavigationDots from '@/components/NavigationDots';

export default function NavigationDotsFixture() {
  const [maxSteps] = useValue('maxSteps', { defaultValue: 3 });
  const [currentStep, setCurrentStep] = useValue<number>('currentStep', {
    defaultValue: 1,
  });
  return (
    <NavigationDots
      currentStep={currentStep}
      maxStep={maxSteps}
      setStep={setCurrentStep}
    />
  );
}
