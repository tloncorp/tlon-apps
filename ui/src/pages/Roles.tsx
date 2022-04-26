import { Field, Form, Formik } from 'formik';
import React from 'react';
import { useGroup, useGroupState, useRouteGroup } from '../state/groups';
import { Cabal } from '../types/groups';

function Role(props: { sect: string; cabal: Cabal }) {
  const { sect, cabal } = props;
  const flag = useRouteGroup();
  const onDelete = () => {
    useGroupState.getState().delRole(flag, sect);
  };

  return (
    <li className="text-mono grow flex justify-between w-full">
      {sect}
      <button onClick={onDelete}>x</button>
    </li>
  );
}

interface FormSchema {
  title: string;
  description: string;
}

export function AddRole(props: {}) {
  const flag = useRouteGroup();
  const initialValues: FormSchema = {
    title: '',
    description: '',
  };
  const onSubmit = (values: FormSchema) => {
    useGroupState.getState().addRole(flag, values.title, values);
  };
  return (
    <div>
      <h4>Add Role</h4>
      <Formik onSubmit={onSubmit} initialValues={initialValues}>
        <Form>
          <Field name="title" type="text" />
          <Field name="description" type="text" />
          <button type="submit">Add</button>
        </Form>
      </Formik>
    </div>
  );
}

export default function Roles() {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  const sects = Object.keys(group.cabals);
  return (
    <div className="p-2 w-100">
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
