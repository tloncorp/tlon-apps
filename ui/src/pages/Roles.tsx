import React from 'react';
import { useForm } from 'react-hook-form';
import MetadataForm from '../components/MetadataForm/MetadataForm';
import { useGroup, useGroupState, useRouteGroup } from '../state/groups';
import { Cabal } from '../types/groups';

function Role(props: { sect: string; cabal: Cabal }) {
  const { sect, cabal } = props;
  const flag = useRouteGroup();
  const onDelete = () => {
    useGroupState.getState().delRole(flag, sect);
  };

  return (
    <li className="text-mono flex w-full grow justify-between">
      {sect}
      {cabal.meta.description}
      <button onClick={onDelete}>x</button>
    </li>
  );
}

interface FormSchema {
  title: string;
  description: string;
  image: string;
}

export function AddRole() {
  const flag = useRouteGroup();
  const defaultValues: FormSchema = {
    title: '',
    description: '',
    image: '',
  };
  const onSubmit = (values: FormSchema) => {
    useGroupState.getState().addRole(flag, values.title, values);
  };
  const { register, handleSubmit } = useForm({ defaultValues });
  return (
    <div>
      <h4>Add Role</h4>
      <form onSubmit={handleSubmit(onSubmit)}>
        <MetadataForm register={register} />

        <button type="submit">Add</button>
      </form>
    </div>
  );
}

export default function Roles() {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  const sects = Object.keys(group.cabals);
  return (
    <div className="w-100 p-2">
      <h1>Role</h1>
      <AddRole />
      <ul className="w-100">
        {sects.map((sect) => (
          <Role key={sect} sect={sect} cabal={group.cabals[sect]} />
        ))}
      </ul>
    </div>
  );
}
