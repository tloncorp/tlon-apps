import React from 'react';
import {
  ArrayPath,
  Control,
  UseFormRegister,
  useFieldArray,
  useForm,
} from 'react-hook-form';

interface Schema {
  roles: { value: string }[];
}

export default function RoleInput(props: {
  control: Control<Schema, any>;
  register: UseFormRegister<Schema>;
  options: string[];
}) {
  const { control, register, options } = props;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'roles',
  });
  const unpicked = options.filter(
    (o) => !fields.some(({ value }) => value === o)
  );

  const onAdd = () => {
    append({ value: unpicked[0] });
  };

  return (
    <div className="flex flex-col">
      {fields.map((field, index) => (
        <div className="flex" key={index}>
          <select key={field.id} {...register(`roles.${index}.value`)}>
            <option key={field.value}>{field.value}</option>
            {unpicked.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <button onClick={() => remove(index)} type="button">
            X
          </button>
        </div>
      ))}
      {unpicked.length > 0 ? (
        <button onClick={onAdd} type="button">
          Add Role
        </button>
      ) : null}
    </div>
  );
}
