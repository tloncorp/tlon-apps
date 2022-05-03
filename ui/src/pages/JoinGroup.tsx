import { Field, Form, Formik } from 'formik';
import React from 'react';

interface FormSchema {
  flag: string;
}

export default function JoinGroup() {
  const initialValues: FormSchema = {
    flag: '',
  };

  const onSubmit = (values: FormSchema) => {
    console.log(values);
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
          Join Group
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
