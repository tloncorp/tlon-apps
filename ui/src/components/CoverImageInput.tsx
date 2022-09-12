import React from 'react';
import cn from 'classnames';
import { useFormContext } from 'react-hook-form';
import { NoteEssay } from '@/types/diary';

interface CoverImageInputProps {
  className?: string;
  url?: string;
}

export default function CoverImageInput({
  className = '',
  url,
}: CoverImageInputProps) {
  const { register, watch } =
    useFormContext<Pick<NoteEssay, 'title' | 'image'>>();
  const image = watch('image');

  return (
    <div
      className={cn(
        'relative h-36 w-full rounded-lg bg-gray-100 bg-cover bg-center px-4',
        className
      )}
      style={image ? { backgroundImage: `url(${image})` } : {}}
    >
      <div className="absolute bottom-0 left-0 w-full p-4">
        {!image && (
          <label className="mb-1 block font-semibold text-gray-400">
            Optional Cover Image
          </label>
        )}
        <input
          type="url"
          {...register('image')}
          defaultValue={url}
          className="input w-full"
        />
      </div>
    </div>
  );
}
