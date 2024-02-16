import { useStep } from 'usehooks-ts';

import Dialog from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';

import NewGroup from './NewGroup';

export default function NewGroupDialog() {
  const maxStep = 3;
  const [currentStep, { goToNextStep, goToPrevStep, setStep }] =
    useStep(maxStep);
  const dismiss = useDismissNavigate();
  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  return (
    <Dialog
      defaultOpen
      modal
      onOpenChange={onOpenChange}
      onInteractOutside={(e) => e.preventDefault()}
      className="sm:inset-y-24"
      containerClass="w-full h-full sm:max-w-2xl"
    >
      <NewGroup
        stepMeta={{
          currentStep,
          maxStep,
          goToNextStep,
          goToPrevStep,
          setStep,
        }}
      />
    </Dialog>
  );
}
