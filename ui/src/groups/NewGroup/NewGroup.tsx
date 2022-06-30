import React, { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { useGroupState } from '../../state/groups';
import { strToSym } from '../../logic/utils';
import useStep from '../../logic/useStep';
import TemplateOrScratch from './TemplateOrScratch';
import NewGroupForm from './NewGroupForm';

interface NewGroupProps {
  close: () => void;
}

interface NewGroupFormSchema {
  title: string;
  description: string;
  image: string;
  color: string;
}

export default function NewGroup({ close }: NewGroupProps) {
  const navigate = useNavigate();
  const [currentStep, { goToNextStep, goToPrevStep }] = useStep(4);
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
    watch,
  } = useForm<NewGroupFormSchema>({
    defaultValues,
    mode: 'onBlur',
  });
  const onSubmit = async (values: NewGroupFormSchema) => {
    const name = strToSym(values.title);
    await useGroupState.getState().create({ ...values, name });
    const flag = `${window.our}/${name}`;
    navigate(`/groups/${flag}`);
  };

  const nextWithTemplate = (templateType?: string) => {
    // TODO: handle different templates
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
        />
      );
      break;
    case 3:
      currentStepComponent = <span>Third</span>;
      break;
    case 4:
      currentStepComponent = <span>Fourth</span>;
      break;
    default:
      currentStepComponent = <span>An error occurred</span>;
      break;
  }

  return (
    <form className="flex flex-col" onSubmit={handleSubmit(onSubmit)}>
      <div>{currentStepComponent}</div>
      <div className="flex justify-end space-x-2 pt-4">
        {currentStep !== 1 ? (
          <button className="secondary-button" onClick={goToPrevStep}>
            Back
          </button>
        ) : null}
        {currentStep !== 4 && currentStep !== 1 ? (
          <button
            disabled={currentStep === 2 && !isValid}
            className="button"
            onClick={goToNextStep}
          >
            Next
          </button>
        ) : null}
        {currentStep === 4 ? (
          <button className="button" type="submit" onClick={close}>
            Done
          </button>
        ) : null}
      </div>
    </form>
  );
}
