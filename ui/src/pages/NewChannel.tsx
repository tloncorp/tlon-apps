import React from 'react';
import { Field, Form, Formik } from 'formik';
import { useChatState } from '../state/chat';
import {useParams} from 'react-router';

export default function NewChannel() {
  const { ship, name } = useParams();
  const group = `${ship}/${name}`;
  const initialValues = {
    title: '',
    description: '',
  };
  const onSubmit = (values: any) => {
    useChatState.getState().create({ ...values, name: values.title, group });
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
