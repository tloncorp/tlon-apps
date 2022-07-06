import React from 'react';
import { useForm } from 'react-hook-form';
import RoleInput from '../groups/RoleInput/RoleInput';
import {
  useGroup,
  useGroupState,
  useRouteGroup,
  useVessel,
} from '../state/groups/groups';

interface FormSchema {
  roles: { value: string }[];
}
function Member(props: { ship: string }) {
  const { ship } = props;
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const vessel = useVessel(flag, ship);
  const defaultValues: FormSchema = {
    roles: vessel.sects.map((value) => ({ value })),
  };
  // TODO: remove as well
  const onChangeRoles = (values: FormSchema) => {
    const sects = values.roles.map((r) => r.value);
    useGroupState.getState().addSects(flag, ship, sects);
  };
  const { register, control, handleSubmit } = useForm({ defaultValues });

  if (!group) {
    return null;
  }

  return (
    <li className="text-mono flex justify-between">
      {ship}
      <div>
        <form
          className="flex w-56 flex-col space-y-2"
          onSubmit={handleSubmit(onChangeRoles)}
        >
          <RoleInput
            register={register}
            control={control}
            options={Object.keys(group.cabals)}
          />
          <button type="submit">Update Writers</button>
        </form>
      </div>
    </li>
  );
}

export default function Members() {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  if (!group) {
    return null;
  }

  const ships = Object.keys(group.fleet);
  return (
    <div className="p-2">
      <h1>Members</h1>
      <ul>
        {ships.map((ship) => (
          <Member key={ship} ship={ship} />
        ))}
      </ul>
    </div>
  );
}
