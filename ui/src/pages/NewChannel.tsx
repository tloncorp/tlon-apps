import React from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router';
import { useChatState } from '../state/chat';

interface FormSchema {
  title: string;
  description: string;
}

export default function NewChannel() {
  const { ship, name } = useParams();
  const group = `${ship}/${name}`;
  const defaultValues: FormSchema = {
    title: '',
    description: '',
  };
  const { handleSubmit, register } = useForm<FormSchema>({ defaultValues });
  const onSubmit = (values: FormSchema) => {
    useChatState
      .getState()
      .create({ ...values, name: values.title, group, readers: [] });
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
      <div className="p-2">
        <label htmlFor="title">Title</label>
        <input
          {...register('title')}
          className="rounded border"
          type="text"
          name="title"
        />
      </div>
      <div className="p-2">
        <label htmlFor="description">Description</label>
        <input
          {...register('description')}
          className="rounded border"
          type="text"
          name="description"
        />
      </div>
      <button type="submit">Submit</button>
    </form>
  );
}
