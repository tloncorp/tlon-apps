import React, { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { useGroupState } from '@/state/groups';
import { strToSym } from '@/logic/utils';
import useStep from '@/logic/useStep';
import TemplateOrScratch from '@/groups/NewGroup/TemplateOrScratch';
import NewGroupForm from '@/groups/NewGroup/NewGroupForm';
import NewGroupPrivacy from '@/groups/NewGroup/NewGroupPrivacy';
import NewGroupInvite from '@/groups/NewGroup/NewGroupInvite';
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

type Role = 'Member' | 'Moderator' | 'Admin';

interface ShipWithRole {
  patp: string;
  role: Role;
}

type TemplateTypes = 'none' | 'small' | 'medium' | 'large';

export default function NewGroup() {
  const navigate = useNavigate();
  const dismiss = useDismissNavigate();
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyTypes>();
  const [shipsToInvite, setShipsToInvite] = useState<ShipWithRole[]>([]);
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

  const {
    handleSubmit,
    register,
    formState: { errors, isValid },
    setValue,
    getValues,
    watch,
  } = useForm<NewGroupFormSchema>({
    defaultValues,
    mode: 'onBlur',
  });

  const setGroupPrivacy = async () => {
    setTimeout(
      () =>
        new Promise(() => {
          console.log('TODO: setGroupPrivacy', { selectedPrivacy });
        }),
      2
    );
  };

  const setGroupMembers = async () => {
    setTimeout(
      () =>
        new Promise(() => {
          console.log('TODO: setGroupMembers', { shipsToInvite });
        })
    );
  };

  const onComplete = async () => {
    const values = getValues();
    const name = strToSym(values.title);
    await useGroupState.getState().create({ ...values, name });
    const flag = `${window.our}/${name}`;
    await setGroupPrivacy();
    await setGroupMembers();
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
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
          isValid={isValid}
          goToPrevStep={goToPrevStep}
          goToNextStep={goToNextStep}
        />
      );
      break;
    case 3:
      currentStepComponent = (
        <NewGroupPrivacy
          groupName={getValues('title')}
          goToPrevStep={goToPrevStep}
          goToNextStep={goToNextStep}
          selectedPrivacy={selectedPrivacy}
          setSelectedPrivacy={setSelectedPrivacy}
        />
      );
      break;
    case 4:
      currentStepComponent = (
        <NewGroupInvite
          groupName={getValues('title')}
          goToPrevStep={goToPrevStep}
          goToNextStep={onComplete}
          shipsToInvite={shipsToInvite}
          setShipsToInvite={setShipsToInvite}
        />
      );
      break;
    default:
      currentStepComponent = <span>An error occurred</span>;
      break;
  }

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent containerClass="w-full sm:max-w-lg">
        <div className="flex flex-col">{currentStepComponent}</div>
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
