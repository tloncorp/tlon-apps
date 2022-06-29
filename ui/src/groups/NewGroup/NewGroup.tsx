import React, { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { useGroupState } from '../../state/groups';
import MetadataForm from '../../components/MetadataForm/MetadataForm';
import { strToSym } from '../../logic/utils';
import useStep from '../../logic/useStep';
import TemplateOrScratch from './TemplateOrScratch';

interface NewGroupProps {
  close: () => void;
}

interface FormSchema {
  title: string;
  description: string;
  image: string;
  color: string;
}

export default function NewGroup({ close }: NewGroupProps) {
  const navigate = useNavigate();
  const [currentStep, { goToNextStep, goToPrevStep }] = useStep(4);
  const defaultValues: FormSchema = {
    title: '',
    description: '',
    image: '',
    color: '',
  };
  const { handleSubmit, register } = useForm<FormSchema>({ defaultValues });
  const onSubmit = async (values: FormSchema) => {
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
      currentStepComponent = <span>Second</span>;
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
    <div className="flex flex-col">
      <div>{currentStepComponent}</div>
      <div>
        {currentStep !== 1 ? (
          <button className="secondary-button" onClick={goToPrevStep}>
            Back
          </button>
        ) : null}
        {currentStep !== 4 && currentStep !== 1 ? (
          <button className="button" onClick={goToNextStep}>
            Next
          </button>
        ) : null}
        {currentStep === 4 ? (
          <button className="button" onClick={close}>
            Done
          </button>
        ) : null}
      </div>
    </div>
  );

  // return (
  // <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
  // <MetadataForm register={register} />
  // <button type="submit">Submit</button>
  // </form>
  // );
}
