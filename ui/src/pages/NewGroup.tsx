import React from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { useGroupState } from '../state/groups/groups';
import MetadataForm from '../components/MetadataForm/MetadataForm';
import { strToSym } from '../logic/utils';

interface FormSchema {
  title: string;
  description: string;
  image: string;
  color: string;
}
export default function NewGroup() {
  const navigate = useNavigate();
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
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
      <MetadataForm register={register} />
      <button type="submit">Submit</button>
    </form>
  );
}
