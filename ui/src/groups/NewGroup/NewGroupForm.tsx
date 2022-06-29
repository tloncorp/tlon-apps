import React, { useState } from 'react';
import { FieldError, UseFormRegister } from 'react-hook-form';

interface NewGroupFormSchema {
  title: string;
  description: string;
  image: string;
  color: string;
}

export default function NewGroupForm({
  register,
  errors,
}: {
  register: UseFormRegister<NewGroupFormSchema>;
  errors: Record<string, FieldError>;
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
              <input
                className="input"
                {...register('image', { required: true })}
                type="url"
              />
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
              <input
                className="input"
                {...register('color', {
                  required: true,
                  pattern: {
                    value: /^#[0-9a-f]{3,6}$/i,
                    message: 'Please use a valid hex color code.',
                  },
                })}
                type="text"
              />
              <button
                className="secondary-button"
                onClick={() => setIconType(undefined)}
              >
                Cancel
              </button>
            </>
          ) : null}
          {errors.color ? (
            <span className="text-sm">{errors.color.message}</span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col">
        <label htmlFor="title" className="pb-2 font-bold">
          Group Name *
        </label>
        <input
          // TODO: set sane maxLength
          {...register('title', { required: true, maxLength: 180 })}
          className="input"
          type="text"
          placeholder="Title"
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor="description" className="pb-2 font-bold">
          Group Description (optional)
        </label>
        <textarea
          // TODO: set sane maxLength
          {...register('description', { maxLength: 300 })}
          className="input"
        />
      </div>
    </div>
  );
}
