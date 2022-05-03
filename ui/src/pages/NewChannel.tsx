import React from 'react';
import { Field, Form, Formik } from 'formik';
import { useParams } from 'react-router';
import { useChatState } from '../state/chat';

interface FormSchema {
  title: string;
  description: string;
}

export default function NewChannel() {
  const { ship, name } = useParams();
  const group = `${ship}/${name}`;
  const initialValues: FormSchema = {
    title: '',
    description: '',
  };
  const onSubmit = (values: FormSchema) => {
    useChatState
      .getState()
      .create({ ...values, name: values.title, group, readers: [] });
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
