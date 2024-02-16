import { useStep } from 'usehooks-ts';

import MobileHeader from '@/components/MobileHeader';

import NewGroup from './NewGroup';

export default function NewGroupView() {
  const maxStep = 3;
  const [currentStep, { goToNextStep, goToPrevStep, setStep }] =
    useStep(maxStep);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      <MobileHeader
        title="New Group"
        pathBack={currentStep === 1 ? '/' : undefined}
        pathBackText={currentStep === 1 ? 'Cancel' : undefined}
        goBack={currentStep === 1 ? undefined : goToPrevStep}
        goBackText={currentStep === 1 ? undefined : 'Back'}
      />
      <div className="grow overflow-y-auto p-4">
        <NewGroup
          stepMeta={{
            currentStep,
            maxStep,
            goToNextStep,
            goToPrevStep,
            setStep,
          }}
        />
      </div>
    </div>
  );
}
