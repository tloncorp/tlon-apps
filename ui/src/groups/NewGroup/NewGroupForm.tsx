import React, { useState } from 'react';
import { UseFormRegister } from 'react-hook-form';

interface NewGroupFormSchema {
  title: string;
  description: string;
  image: string;
  color: string;
}

export default function NewGroupForm({
  register,
}: {
  register: UseFormRegister<NewGroupFormSchema>;
}) {
  const [iconType, setIconType] = useState<'image' | 'color'>();

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col">
        <span className="text-lg font-bold">Group Info</span>
        <span className="pt-1 font-bold text-gray-600">
          Fill out information about your group
        </span>
      </div>
      <div className="flex flex-col">
        <span className="pb-2 font-bold">Group Icon *</span>
        <div className="flex items-center space-x-2">
          {iconType === undefined ? (
            <>
              <button
                className="secondary-button"
                onClick={() => setIconType('image')}
              >
                Image URL
              </button>
              <span className="text-sm font-semibold">or</span>
              <button
                className="secondary-button"
                onClick={() => setIconType('color')}
              >
                Fill Color
              </button>
            </>
          ) : null}
          {iconType === 'image' ? (
            <>
              <input className="input" {...register('image')} type="url" />
              <button
                className="secondary-button"
                onClick={() => setIconType(undefined)}
              >
                Cancel
              </button>
            </>
          ) : null}
          {iconType === 'color' ? (
            <>
              <input className="input" {...register('color')} type="text" />
              <button
                className="secondary-button"
                onClick={() => setIconType(undefined)}
              >
                Cancel
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col">
        <label htmlFor="title" className="pb-2 font-bold">
          Group Name *
        </label>
        <input
          {...register('title')}
          className="input"
          type="text"
          placeholder="Title"
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor="description" className="pb-2 font-bold">
          Group Description (optional)
        </label>
        <input {...register('description')} className="input" type="textarea" />
      </div>
    </div>
  );
}
