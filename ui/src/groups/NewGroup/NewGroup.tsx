import React, { ReactElement, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { useGroupState } from '@/state/groups';
import { strToSym } from '@/logic/utils';
import TemplateOrScratch from '@/groups/NewGroup/TemplateOrScratch';
import NewGroupForm from '@/groups/NewGroup/NewGroupForm';
import NewGroupPrivacy from '@/groups/NewGroup/NewGroupPrivacy';
import NewGroupInvite from '@/groups/NewGroup/NewGroupInvite';
import Dialog, { DialogContent } from '@/components/Dialog';
import NavigationDots from '@/components/NavigationDots';
import { useDismissNavigate } from '@/logic/routing';
import { GroupFormSchema } from '@/types/groups';
import { useStep } from 'usehooks-ts';

type Role = 'Member' | 'Moderator' | 'Admin';

interface ShipWithRoles {
  patp: string;
  roles: Role[];
}

type TemplateTypes = 'none' | 'small' | 'medium' | 'large';

export default function NewGroup() {
  const navigate = useNavigate();
  const dismiss = useDismissNavigate();
  const [shipsToInvite, setShipsToInvite] = useState<ShipWithRoles[]>([]);
  const [templateType, setTemplateType] = useState<TemplateTypes>('none');

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const maxStep = 4;
  const [currentStep, { goToNextStep, goToPrevStep, setStep }] =
    useStep(maxStep);

  const defaultValues: GroupFormSchema = {
    title: '',
    description: '',
    image: '',
    color: '',
    privacy: 'public',
  };

  const form = useForm<GroupFormSchema>({
    defaultValues,
    mode: 'onBlur',
  });

  const onComplete = useCallback(async () => {
    const { privacy, ...values } = form.getValues();
    const name = strToSym(values.title);
    const members = shipsToInvite.reduce(
      (obj, ship) => ({
        ...obj,
        [ship.patp]: ship.roles.map((r) => strToSym(r)),
      }),
      {}
    );
    const cordon =
      privacy === 'public'
        ? {
            open: {
              ships: [],
              ranks: [],
            },
          }
        : {
            shut: [],
          };

    await useGroupState.getState().create({ ...values, name, members, cordon });
    const flag = `${window.our}/${name}`;
    navigate(`/groups/${flag}`);
  }, [shipsToInvite, navigate, form]);

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
        />
      );
      break;
    case 4:
      currentStepComponent = (
        <NewGroupInvite
          groupName={form.getValues('title')}
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
        <FormProvider {...form}>
          <div className="flex flex-col">{currentStepComponent}</div>
        </FormProvider>
        <div className="flex flex-col items-center pt-4">
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
