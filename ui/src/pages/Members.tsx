import { Form, Formik, Field, FieldArray } from 'formik';
import React from 'react';
import {
  useGroup,
  useGroupState,
  useRouteGroup,
  useVessel,
} from '../state/groups';

interface FormSchema {
  sects: string[];
}
function Member(props: { ship: string }) {
  const { ship } = props;
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const vessel = useVessel(flag, ship);
  const initialValues: FormSchema = {
    sects: vessel.sects,
  };
  const onChangeRoles = (values: FormSchema) => {
    useGroupState.getState().addSects(flag, ship, values.sects);
  };

  return (
    <li className="text-mono flex justify-between">
      {ship}
      <div>
        <Formik onSubmit={onChangeRoles} initialValues={initialValues}>
          {({ values }) => (
            <Form className="flex w-56 flex-col space-y-2">
              <FieldArray name="sects">
                {({ remove, push }) => {
                  const unpicked = Object.keys(group.cabals).filter(
                    (s) => !values.sects.includes(s)
                  );
                  return (
                    <>
                      {values.sects.map((sect, idx) => (
                        <div className="flex justify-between p-2">
                          <Field as="select" name={`sects.${idx}`}>
                            <option key={sect} value={sect}>
                              {sect}
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
      </div>
    </li>
  );
}

export default function Members() {
  const flag = useRouteGroup();
  const group = useGroup(flag);

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
