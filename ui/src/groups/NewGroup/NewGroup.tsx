import React, { ReactElement, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { useStep } from 'usehooks-ts';
import { useGroupState } from '@/state/groups';
import { strToSym } from '@/logic/utils';
import NewGroupForm from '@/groups/NewGroup/NewGroupForm';
import NewGroupPrivacy from '@/groups/NewGroup/NewGroupPrivacy';
import NewGroupInvite from '@/groups/NewGroup/NewGroupInvite';
import Dialog, { DialogContent } from '@/components/Dialog';
import NavigationDots from '@/components/NavigationDots';
import { useDismissNavigate } from '@/logic/routing';
import { Cordon, GroupFormSchema } from '@/types/groups';
import { Status } from '@/logic/status';

type Role = 'Member' | 'Moderator' | 'Admin';

interface ShipWithRoles {
  patp: string;
  roles: Role[];
}

// type TemplateTypes = 'none' | 'small' | 'medium' | 'large';

export default function NewGroup() {
  const navigate = useNavigate();
  const dismiss = useDismissNavigate();
  const [shipsToInvite, setShipsToInvite] = useState<ShipWithRoles[]>([]);
  const [status, setStatus] = useState<Status>('initial');
  // const [templateType, setTemplateType] = useState<TemplateTypes>('none');

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      dismiss();
    }
  };

  const maxStep = 3;
  const [currentStep, { goToNextStep, goToPrevStep, setStep }] =
    useStep(maxStep);

  const defaultValues: GroupFormSchema = {
    title: '',
    description: '',
    image: '',
    cover: '',
    privacy: 'public',
  };

  const form = useForm<GroupFormSchema>({
    defaultValues,
    mode: 'onChange',
  });

  const onComplete = useCallback(async () => {
    const { privacy, ...values } = form.getValues();
    const name = strToSym(values.title).replace(
      /[^a-z]*([a-z][-\w\d]+)/i,
      '$1'
    );
    const members = shipsToInvite.reduce(
      (obj, ship) => ({
        ...obj,
        [ship.patp]: ship.roles.map((r) => strToSym(r)),
      }),
      {}
    );
    const cordon: Cordon =
      privacy === 'public'
        ? {
            open: {
              ships: [],
              ranks: [],
            },
          }
        : {
            shut: {
              pending: shipsToInvite.map((s) => s.patp),
              ask: [],
            },
          };

    setStatus('loading');

    try {
      await useGroupState.getState().create({
        ...values,
        name,
        members,
        cordon,
        secret: privacy === 'secret',
      });

      setStatus('success');
      const flag = `${window.our}/${name}`;
      navigate(`/groups/${flag}`);
    } catch (error) {
      setStatus('error');
    }
  }, [shipsToInvite, navigate, form]);

  // const nextWithTemplate = (template?: string) => {
  //   setTemplateType(template ? (template as TemplateTypes) : 'none');
  //   goToNextStep();
  // };

  let currentStepComponent: ReactElement;

  switch (currentStep) {
    // TODO: implement group templates
    // case 1:
    // currentStepComponent = <TemplateOrScratch next={nextWithTemplate} />;
    // break;
    case 1:
      currentStepComponent = (
        <NewGroupForm
          isValid={form.formState.isValid}
          // goToPrevStep={goToPrevStep}
          goToNextStep={goToNextStep}
        />
      );
      break;
    case 2:
      currentStepComponent = (
        <NewGroupPrivacy
          groupName={form.getValues('title')}
          goToPrevStep={goToPrevStep}
          goToNextStep={goToNextStep}
        />
      );
      break;
    case 3:
      currentStepComponent = (
        <NewGroupInvite
          status={status}
          groupName={form.getValues('title')}
          groupPrivacy={form.getValues('privacy')}
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
    <Dialog defaultOpen modal={true} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="w-[500px] sm:inset-y-24"
        containerClass="w-full h-full sm:max-w-lg"
      >
        <FormProvider {...form}>
          <div className="flex flex-col">{currentStepComponent}</div>
        </FormProvider>
        <div className="flex flex-col items-center pt-4">
          <NavigationDots
            maxStep={maxStep}
            currentStep={currentStep}
            setStep={(step) => setStep(step + 1)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
