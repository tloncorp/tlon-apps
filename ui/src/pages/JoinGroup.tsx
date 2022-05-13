import React from 'react';
import { useForm } from 'react-hook-form';
import { useModalNavigate } from '../logic/routing';
import { useGroupState } from '../state/groups';

interface FormSchema {
  flag: string;
}

export default function JoinGroup() {
  const navigate = useModalNavigate();
  const defaultValues: FormSchema = {
    flag: '',
  };

  const onSubmit = async (values: FormSchema) => {
    const { flag } = values;
    await useGroupState.getState().search(values.flag);
    navigate(`/gangs/${flag}`);
  };
  const { handleSubmit, register } = useForm({ defaultValues });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col space-y-4 p-4"
    >
      <h4 className="font-bold">Join Group</h4>
      <div className="flex items-center space-x-2">
        <label htmlFor="flag">Group Name</label>
        <input {...register('flag')} name="flag" className="rounded border" />
      </div>
      <button type="submit" className="mr-auto rounded border px-2">
        Search Group
      </button>
    </form>
  );
}

export function JoinGroupModal() {
  return (
    <div className="">
      <JoinGroup />
    </div>
  );
}
