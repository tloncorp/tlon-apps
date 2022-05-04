import React from 'react';
import { useGroupState } from '../state/groups';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import MetadataForm from '../components/MetadataForm/MetadataForm';

interface FormSchema {
  title: string;
  description: string;
  image: string;
}
export default function NewGroup() {
  const navigate = useNavigate();
  const defaultValues: FormSchema = {
    title: '',
    description: '',
    image: '',
  };
  const { handleSubmit, register } = useForm<FormSchema>({ defaultValues });
  const onSubmit = async (values: FormSchema) => {
    await useGroupState.getState().create({ ...values, name: values.title });
    const flag = `${window.our}/${values.title}`;
    navigate(`/groups/${flag}`);
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
      <MetadataForm register={register} />
      <button type="submit">Submit</button>
    </form>
  );
}
