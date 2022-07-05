import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useChatState } from '../state/chat';
import { useRouteGroup } from '../state/groups/groups';
import { strToSym } from '../logic/utils';

interface FormSchema {
  title: string;
  description: string;
}

export default function NewChannel() {
  const group = useRouteGroup();
  const navigate = useNavigate();
  const defaultValues: FormSchema = {
    title: '',
    description: '',
  };
  const { handleSubmit, register } = useForm<FormSchema>({ defaultValues });
  const onSubmit = async (values: FormSchema) => {
    const name = strToSym(values.title);
    await useChatState
      .getState()
      .create({ ...values, name, group, readers: [] });
    navigate(`../channels/chat/${window.our}/${name}`);
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
