import { Field, Form, Formik } from 'formik';
import React from 'react';
import api from '../api';
import {useModalNavigate} from '../hooks/routing';
import {useGroupState} from '../state/groups';

interface FormSchema {
  flag: string;
}

export default function JoinGroup() {
  const navigate = useModalNavigate();
  const initialValues: FormSchema = {
    flag: '',
  };

  const onSubmit = async (values: FormSchema) => {
    const { flag } = values;
    await useGroupState.getState().search(values.flag);
    navigate(`/gangs/${flag}`);
  };

  return (
    <Formik onSubmit={onSubmit} initialValues={initialValues}>
      <Form className="flex flex-col space-y-4 p-4">
        <h4 className="font-bold">Join Group</h4>
        <div className="flex items-center space-x-2">
          <label htmlFor="flag">Group Name</label>
          <Field name="flag" className="rounded border" />
        </div>
        <button type="submit" className="mr-auto rounded border px-2">
          Search Group
        </button>
      </Form>
    </Formik>
  );
}


export function JoinGroupModal() {
  return (
    <div className="">
      <JoinGroup />
    </div>
  );
}
