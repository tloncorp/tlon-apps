import React from 'react';
import { UseFormRegister } from 'react-hook-form';

interface MetadataSchema {
  title: string;
  description: string;
  image: string;
  color: string;
}

export default function MetadataForm(props: {
  register: UseFormRegister<MetadataSchema>;
}) {
  const { register } = props;

  return (
    <div className="flex flex-col">
      <div className="p-2">
        <label htmlFor="title">Title</label>
        <input {...register('title')} className="rounded border" type="text" />
      </div>
      <div className="p-2">
        <label htmlFor="description">Description</label>
        <input
          {...register('description')}
          className="rounded border"
          type="text"
        />
      </div>
      <div className="p-2">
        <label htmlFor="image">Image</label>
        <input {...register('image')} className="rounded border" type="url" />
      </div>
      <div className="p-2">
        <label htmlFor="color">Color</label>
        <input {...register('color')} className="rounded border" type="text" />
      </div>
    </div>
  );
}
