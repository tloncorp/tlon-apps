import React from 'react';
import { Field, Form, Formik } from 'formik';
import {useGroupState} from '../state/groups';
import {useParams} from 'react-router';

export default function NewGroup() {
  const initialValues = {
    title: '',
    description: '',
  };
  const onSubmit = (values: any) => {
    useGroupState.getState().create({...values, name: values.title});
  };
  return (
    <Formik onSubmit={onSubmit} initialValues={initialValues}>
        <Form className="flex flex-col">
          <div className="p-2">
            <label htmlFor="title">Title</label>
            <Field className="rounded border" type="text" name="title" />
          </div>
          <div className="p-2">
            <label htmlFor="description">Description</label>
            <Field className="rounded border" type="text" name="description" />
          </div>
          <button type="submit">Submit</button>
        </Form>
    </Formik>
  );
}
