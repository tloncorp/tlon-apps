import React, { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { useGroupState } from '@/state/groups';
import { strToSym } from '@/logic/utils';
import useStep from '@/logic/useStep';
import TemplateOrScratch from '@/groups/NewGroup/TemplateOrScratch';
import NewGroupForm from '@/groups/NewGroup/NewGroupForm';
import NewGroupPrivacy from '@/groups/NewGroup/NewGroupPrivacy';
import Dialog, { DialogContent } from '@/components/Dialog';
import NavigationDots from '@/components/NavigationDots';
import { useDismissNavigate } from '@/logic/routing';

interface NewGroupFormSchema {
  title: string;
  description: string;
  image: string;
  color: string;
}

type PrivacyTypes = 'public' | 'private' | 'secret';
type TemplateTypes = 'none' | 'small' | 'medium' | 'large';

export default function NewGroup() {
  const navigate = useNavigate();
  const dismiss = useDismissNavigate();
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyTypes>();
  const [templateType, setTemplateType] = useState<TemplateTypes>('none');

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const [currentStep, { goToNextStep, goToPrevStep, setStep, maxStep }] =
    useStep(4);

  const defaultValues: NewGroupFormSchema = {
    title: '',
    description: '',
    image: '',
    color: '',
  };

  const form = useForm<NewGroupFormSchema>({
    defaultValues,
    mode: 'onBlur',
  });

  const onSubmit = async (values: NewGroupFormSchema) => {
    // TODO: Add channels based on template type (if any).
    const name = strToSym(values.title);
    await useGroupState.getState().create({ ...values, name });
    const flag = `${window.our}/${name}`;
    navigate(`/groups/${flag}`);
  };

  const nextWithTemplate = (template?: string) => {
    setTemplateType(template ? (template as TemplateTypes) : 'none');
    goToNextStep();
  };

  let currentStepComponent: ReactElement;

  switch (currentStep) {
    case 1:
      currentStepComponent = <TemplateOrScratch next={nextWithTemplate} />;
      break;
    case 2:
      currentStepComponent = (
        <NewGroupForm
          isValid={form.formState.isValid}
          goToPrevStep={goToPrevStep}
          goToNextStep={goToNextStep}
        />
      );
      break;
    case 3:
      currentStepComponent = (
        <NewGroupPrivacy
          groupName={form.getValues('title')}
          goToPrevStep={goToPrevStep}
          goToNextStep={goToNextStep}
          selectedPrivacy={selectedPrivacy}
          setSelectedPrivacy={setSelectedPrivacy}
        />
      );
      break;
    case 4:
      currentStepComponent = (
        <button type="submit" className="button">
          Done
        </button>
      );
      break;
    default:
      currentStepComponent = <span>An error occurred</span>;
      break;
  }

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent containerClass="w-full sm:max-w-lg">
        <FormProvider {...form}>
          <form
            className="flex flex-col"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            {currentStepComponent}
          </form>
        </FormProvider>
        <div className="flex flex-col items-center">
          {currentStep !== 1 ? (
            <NavigationDots
              maxStep={maxStep - 1}
              currentStep={currentStep - 1}
              setStep={(step) => setStep(step + 1)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
