import cn from 'classnames';
import React, { MouseEvent, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { UploadErrorPopover } from '@/chat/ChatInput/ChatInput';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useCalm } from '@/state/settings';
import { useUploader } from '@/state/storage';

interface CoverImageInputProps {
  className?: string;
  url?: string;
  noteId?: string;
}

export default function CoverImageInput({
  className = '',
  url,
  noteId,
}: CoverImageInputProps) {
  const { register, watch, setValue } = useFormContext<{
    image?: string;
  }>();
  const image = watch('image');
  const calm = useCalm();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [haveUploaded, setHaveUploaded] = useState(false);
  const uploader = useUploader(`cover-image-input-${noteId || 'new'}`);
  const mostRecentFile = uploader?.getMostRecent();

  useEffect(() => {
    if (
      mostRecentFile &&
      mostRecentFile.status === 'error' &&
      mostRecentFile.errorMessage
    ) {
      setUploadError(mostRecentFile.errorMessage);
    }

    if (mostRecentFile && mostRecentFile.status === 'success' && haveUploaded) {
      setValue('image', mostRecentFile.url);
    }
  }, [mostRecentFile, setValue, haveUploaded]);

  const upload = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (uploader) {
      uploader.prompt();
      setHaveUploaded(true);
    }
  };

  return (
    <div
      className={cn(
        'relative h-36 w-full rounded-lg bg-gray-100 bg-cover bg-center px-4',
        className
      )}
      style={
        image && !calm.disableRemoteContent
          ? { backgroundImage: `url(${image})` }
          : {}
      }
    >
      <div className="absolute bottom-0 left-0 w-full p-4">
        {!image && (
          <label className="mb-1 block font-semibold text-gray-400">
            Optional Cover Image
          </label>
        )}
        <div className="input items-center justify-end">
          <input
            type="url"
            {...register('image')}
            defaultValue={url}
            placeholder="Insert URL Here..."
            className="input-inner w-full p-0"
          />
          {uploader ? (
            <button
              title={'Upload an image'}
              className="small-button whitespace-nowrap"
              aria-label="Add attachment"
              onClick={upload}
            >
              {mostRecentFile && mostRecentFile.status === 'loading' ? (
                <LoadingSpinner secondary="black" className="h-4 w-4" />
              ) : (
                'Upload Image'
              )}
            </button>
          ) : null}
          {uploadError ? (
            <div className="absolute mr-2">
              <UploadErrorPopover
                errorMessage={uploadError}
                setUploadError={setUploadError}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
