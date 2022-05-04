import React from 'react';
import { Field, Form, Formik } from 'formik';
import { useGroupState } from '../state/groups';
import {useNavigate} from 'react-router';

interface FormSchema {
  title: string;
  description: string;
  image: string;
}
export default function NewGroup() {
  const navigate = useNavigate();
  const initialValues: FormSchema = {
    title: '',
    description: '',
    image: ''
  };
  const onSubmit = async (values: FormSchema) => {
    await useGroupState.getState().create({ ...values, name: values.title });
    const flag = `${window.our}/${values.title}`;
    navigate(`/groups/${flag}`);
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
        <div className="p-2">
          <label htmlFor="description">Image</label>
          <Field className="rounded border" type="text" name="image" />
        </div>

        <button type="submit">Submit</button>
      </Form>
    </Formik>
  );
}
