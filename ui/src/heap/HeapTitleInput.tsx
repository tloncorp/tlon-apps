import React from 'react';
import { useFormContext } from 'react-hook-form';

export default function HeapTitleInput() {
  const { register } = useFormContext();
  return (
    <label className="mb-3 font-semibold">
      Item Name
      <input
        {...register('title')}
        className="input my-2 block w-full p-1"
        type="text"
      />
    </label>
  );
}
