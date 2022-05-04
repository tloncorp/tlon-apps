import { Field, FieldArray, Form, Formik } from 'formik';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router';
import RoleInput from '../components/RoleInput/RoleInput';
import { useChatPerms, useChatState } from '../state/chat';
import { useGroup, useRouteGroup } from '../state/groups';

interface FormSchema {
  roles: { value: string }[];
}

export default function ChannelSettings() {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const { chShip, chName } = useParams();
  const flag = `${chShip}/${chName}`;
  const perm = useChatPerms(flag);
  const defaultValues: FormSchema = {
    roles: perm.writers.map((value) => ({ value })),
  };
  const onSubmit = (values: FormSchema) => {
    const writers = values.roles.map((r) => r.value);
    useChatState.getState().addSects(flag, writers);
  };
  const { register, control, handleSubmit } = useForm({ defaultValues });
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-56 flex-col space-y-2"
    >
      <RoleInput
        register={register}
        options={Object.keys(group.cabals)}
        control={control}
      />
      <button type="submit">Update Writers</button>
    </form>
  );
}
