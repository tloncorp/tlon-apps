import { Field, FieldArray, Form, Formik } from 'formik';
import React from 'react';
import { useParams } from 'react-router';
import { useChatState } from '../state/chat';
import { useGroup, useRouteGroup } from '../state/groups';

interface FormSchema {
  writers: string[];
}

export default function ChannelSettings(props: {}) {
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
  const { chShip, chName, app } = useParams();
  const flag = `${chShip}/${chName}`;
  const initialValues = {
    writers: [] as string[],
  };
  const onSubmit = (values: FormSchema) => {
    useChatState.getState().addSects(flag, values.writers);
  };
  const sects = (curr: string[]) =>
    Object.keys(group.cabals).filter((s) => {
      console.log(curr, s);
      const result = !curr.includes(s);
      console.log(result);
      return result;
    });
  return (
    <Formik onSubmit={onSubmit} initialValues={initialValues}>
      {({ values }) => (
        <Form className="flex flex-col space-y-2 w-56">
          <FieldArray name="writers">
            {({ insert, remove, push }) => {
              const unpicked = sects(values.writers);
              return (
                <>
                  {values.writers.map((writer, idx) => (
                    <div className="flex justify-between p-2">
                      <Field as="select" name={`writers.${idx}`}>
                        <option key={writer} value={writer}>
                          {writer}
                        </option>
                        {unpicked.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </Field>
                      <button onClick={() => remove(idx)}>x</button>
                    </div>
                  ))}
                  {unpicked.length > 0 ? (
                    <button type="button" onClick={() => push(unpicked[0])}>
                      Add
                    </button>
                  ) : null}
                </>
              );
            }}
          </FieldArray>
          <button type="submit">Update Writers</button>
        </Form>
      )}
    </Formik>
  );
}
