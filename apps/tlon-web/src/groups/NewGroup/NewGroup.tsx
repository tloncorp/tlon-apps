import { ReactElement, useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import NavigationDots from '@/components/NavigationDots';
import NewGroupForm from '@/groups/NewGroup/NewGroupForm';
import NewGroupInvite from '@/groups/NewGroup/NewGroupInvite';
import NewGroupPrivacy from '@/groups/NewGroup/NewGroupPrivacy';
import { strToSym } from '@/logic/utils';
import { useCreateGroupMutation } from '@/state/groups';
import { Cordon, GroupFormSchema } from '@/types/groups';

export type Role = 'Member' | 'Admin';

interface ShipWithRoles {
  patp: string;
  roles: Role[];
}

// type TemplateTypes = 'none' | 'small' | 'medium' | 'large';
//

interface NewGroupProps {
  stepMeta: {
    currentStep: number;
    maxStep: number;
    setStep: (step: number) => void;
    goToNextStep: () => void;
    goToPrevStep: () => void;
  };
}

export default function NewGroup({ stepMeta }: NewGroupProps) {
  const navigate = useNavigate();
  const [shipsToInvite, setShipsToInvite] = useState<ShipWithRoles[]>([]);
  // const [templateType, setTemplateType] = useState<TemplateTypes>('none');
  const { mutate: createGroupMutation, status } = useCreateGroupMutation();

  const maxStep = 3;
  const { currentStep, goToNextStep, goToPrevStep, setStep } = stepMeta;

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

    try {
      createGroupMutation({
        ...values,
        name,
        members,
        cordon,
        secret: privacy === 'secret',
      });

      const flag = `${window.our}/${name}`;
      navigate(`/groups/${flag}`);
    } catch (error) {
      console.log("Couldn't create group", error);
    }
  }, [shipsToInvite, navigate, form, createGroupMutation]);

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
    <>
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
    </>
  );
}
